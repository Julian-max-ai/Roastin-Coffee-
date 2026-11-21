'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const Partner    = require('../models/Partner');
const Infraction = require('../models/Infraction');
const GuildConfig = require('../models/GuildConfig');
const { infractionCard, infractionListCard, infractionEscalationCard, infractionAppealCard, errorCard, successCard, logCard, card, warningCard } = require('../ui');
const { cap, ts, strikeBar, truncate } = require('../utils/format');
const { paginate } = require('../utils/pagination');
const { isStaff } = require('../utils/permissions');
const { EMOJI, STRIKE_LIMIT, PAGE_SIZE, COLORS } = require('../theme');
const { audit } = require('../utils/audit');

function computeExpiry(type, cfg) {
  if (type === 'warning') {
    const days = cfg?.automation?.infractionExpiryWarning ?? 90;
    return days === 0 ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  if (type === 'strike') {
    const days = cfg?.automation?.infractionExpiryStrike ?? 180;
    return days === 0 ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  return null;
}

function updatePartnerStatus(partner, activeStrikes, cfg) {
  const limit = STRIKE_LIMIT;
  if (activeStrikes >= limit) return 'inactive';
  if (activeStrikes >= limit - 1) return 'probation';
  return 'active';
}


module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction')
    .setDescription('Manage partner infractions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('add').setDescription('Issue a warning, strike, or termination.')
      .addStringOption(o => o.setName('partner').setDescription('Partner name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('type').setDescription('Type').setRequired(true)
        .addChoices(
          { name: '⚠️ Warning', value: 'warning' },
          { name: '🔴 Strike', value: 'strike' },
          { name: '🚫 Termination', value: 'termination' },
        ))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('View infractions for a partner.')
      .addStringOption(o => o.setName('partner').setDescription('Partner name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('filter').setDescription('Filter: active or all')
        .addChoices(
          { name: 'Active only', value: 'active' },
          { name: 'All (incl. removed/expired)', value: 'all' },
        )))
    .addSubcommand(s => s.setName('remove').setDescription('Remove an infraction.')
      .addStringOption(o => o.setName('id').setDescription('Infraction ID').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const { guildId } = interaction;
    const focused = interaction.options.getFocused().toLowerCase();
    const sub     = interaction.options.getSubcommand();

    if (sub === 'remove') {
      const infractions = await Infraction.find({ guildId, removed: false }).catch(() => []);
      const partners    = await Partner.find({ guildId });
      const partnerMap  = Object.fromEntries(partners.map(p => [p._id.toString(), p.name]));
      const choices = infractions
        .filter(i => {
          const pName = partnerMap[i.partnerId] || '';
          return pName.toLowerCase().includes(focused) || i.reason.toLowerCase().includes(focused);
        })
        .slice(0, 25)
        .map(i => ({
          name: truncate(`${partnerMap[i.partnerId] || '?'} · ${cap(i.type)} · ${truncate(i.reason, 30)} · ${new Date(i.issuedAt).toLocaleDateString('en-US')}`, 100),
          value: i._id.toString(),
        }));
      return interaction.respond(choices);
    }

    const partners = await Partner.find({ guildId });
    await interaction.respond(
      partners.filter(p => p.name.toLowerCase().includes(focused)).slice(0, 25).map(p => ({ name: p.name, value: p.name }))
    );
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();
    const cfg = await GuildConfig.findOne({ guildId });

    if (sub === 'add') {
      const partnerName = interaction.options.getString('partner');
      const type        = interaction.options.getString('type');
      const reason      = interaction.options.getString('reason');

      const partner = await Partner.findOne({ guildId, name: partnerName });
      if (!partner) return interaction.editReply(errorCard(`No partner named **${partnerName}** found.`));

      const expiresAt = computeExpiry(type, cfg);
      const infraction = await Infraction.create({ guildId, partnerId: partner._id.toString(), type, reason, issuedBy: interaction.user.id, expiresAt });
      const activeStrikes = await Infraction.countDocuments({ guildId, partnerId: partner._id.toString(), type: 'strike', removed: false, expired: false });

      // C6: Update partner status
      const newStatus = updatePartnerStatus(partner, activeStrikes, cfg);
      if (partner.status !== newStatus) {
        await Partner.findByIdAndUpdate(partner._id, { status: newStatus });
      }

      let dmFailed = false;
      try {
        const rep = await interaction.client.users.fetch(partner.representativeId);
        // C4: Appeal button only in DM variant
        await rep.send(infractionCard(infraction, partner, interaction.user.id, activeStrikes, STRIKE_LIMIT, false, true));
      } catch { dmFailed = true; }

      const card = infractionCard(infraction, partner, interaction.user.id, activeStrikes, STRIKE_LIMIT, dmFailed, false);
      await interaction.editReply(card);

      // C1: Escalation in log channel when strike limit reached
      if (type === 'strike' && activeStrikes >= STRIKE_LIMIT) {
        if (!partner.escalationPostedAt && cfg?.logChannel) {
          const ch = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
          if (ch) {
            await ch.send(infractionEscalationCard(partner, activeStrikes, STRIKE_LIMIT, infraction._id)).catch(() => {});
            await Partner.findByIdAndUpdate(partner._id, { escalationPostedAt: new Date() });
          }
        }
      } else if (activeStrikes < STRIKE_LIMIT) {
        // Reset escalation flag when strikes drop below limit
        if (partner.escalationPostedAt) {
          await Partner.findByIdAndUpdate(partner._id, { escalationPostedAt: null });
        }
      }

      // Log card (no duplicate sendLog)
      if (cfg?.logChannel) {
        const ch = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
        if (ch) await ch.send(card).catch(() => {});
      }

      await audit(interaction.guildId, interaction.user.id, 'infraction_add', 'partner', partner._id.toString(), { type, reason, expiresAt });
    }

    if (sub === 'list') {
      const partnerName = interaction.options.getString('partner');
      const filter      = interaction.options.getString('filter') || 'active';
      const partner     = await Partner.findOne({ guildId, name: partnerName });
      if (!partner) return interaction.editReply(errorCard(`No partner named **${partnerName}** found.`));

      const query = filter === 'all'
        ? { guildId, partnerId: partner._id.toString() }
        : { guildId, partnerId: partner._id.toString(), removed: false, expired: false };
      const all    = await Infraction.find(query);
      const strikes = all.filter(i => i.type === 'strike' && !i.removed && !i.expired).length;
      const { items, totalPages, page, row } = paginate(all, 0, PAGE_SIZE, `infractions:${partner._id}:${filter}`);
      const res = infractionListCard(partner, items, page, totalPages, strikes, STRIKE_LIMIT, filter);
      if (row) res.components = [...res.components, row];
      await interaction.editReply(res);
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id');
      const existing = await Infraction.findOne({ _id: id, guildId }).catch(() => null);
      if (!existing) return interaction.editReply(errorCard('Infraction not found. Make sure you selected a valid entry.'));

      const cfg = await GuildConfig.findOne({ guildId });
      const isAdmin = require('../utils/permissions').isAdmin(interaction.member, cfg);
      const isIssuer = existing.issuedBy === interaction.user.id;
      if (!isAdmin && !isIssuer) return interaction.editReply(errorCard('Only the issuer or an admin can remove this infraction.'));

      const infraction = await Infraction.findOneAndUpdate(
        { _id: id, guildId },
        { removed: true },
        { new: true }
      ).catch(() => null);

      if (!infraction) return interaction.editReply(errorCard('Infraction not found. Make sure you selected a valid entry.'));
      await interaction.editReply(successCard(`Infraction \`${id}\` has been removed.`));

      // C8: Audit + recalculate partner status
      const partner = await Partner.findOne({ _id: infraction.partnerId, guildId }).catch(() => null);
      if (partner) {
        const activeStrikes = await Infraction.countDocuments({ guildId, partnerId: partner._id.toString(), type: 'strike', removed: false, expired: false });
        const newStatus = updatePartnerStatus(partner, activeStrikes, cfg);
        if (partner.status !== newStatus) {
          await Partner.findByIdAndUpdate(partner._id, { status: newStatus });
        }
      }
      await audit(interaction.guildId, interaction.user.id, 'infraction_remove', 'infraction', id, { partnerId: infraction.partnerId, type: infraction.type });
    }
  },

  async handleInfractionAppeal(interaction) {
    const infractionId = interaction.customId.split(':')[1];
    const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
    const modal = new ModalBuilder().setCustomId(`infraction_appeal_submit:${infractionId}`).setTitle('Appeal Infraction');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Why should this infraction be removed?').setStyle(TextInputStyle.Paragraph).setRequired(true)
    ));
    return interaction.showModal(modal);
  },

  async handleInfractionAppealSubmit(interaction) {
    const infractionId = interaction.customId.split(':')[1];
    const reason = interaction.fields.getTextInputValue('reason').slice(0, 1000);
    // B3: Load by _id only, guildId from record (DM has no guildId)
    const Infraction = require('../models/Infraction');
    const Partner = require('../models/Partner');
    const inf = await Infraction.findById(infractionId).catch(() => null);
    if (!inf) return interaction.reply(errorCard('Infraction not found.'));
    const partner = await Partner.findOne({ _id: inf.partnerId }).catch(() => null);
    if (!partner) return interaction.reply(errorCard('Partner not found.'));

    // Only the representative can appeal
    if (interaction.user.id !== partner.representativeId) {
      return interaction.reply(errorCard('Only the partner representative can appeal this infraction.'));
    }
    if (inf.appealStatus !== 'none') {
      return interaction.reply(errorCard('An appeal has already been submitted for this infraction.'));
    }

    await Infraction.findByIdAndUpdate(infractionId, { appealStatus: 'pending', appealReason: reason });

    // Post appeal card to log channel
    const cfg = await GuildConfig.findOne({ guildId: inf.guildId });
    if (cfg?.logChannel) {
      const ch = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
      if (ch) await ch.send(infractionAppealCard(inf, partner, reason, interaction.user.id)).catch(() => {});
    }

    return interaction.reply(successCard('Your appeal has been submitted.'));
  },

  async handleInfractionEscalationDecision(interaction) {
    const action = interaction.customId.startsWith('infraction_terminate:') ? 'terminate' : 'dismiss';
    const infractionId = interaction.customId.split(':')[1];
    const { member, guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(member, cfg)) return interaction.reply(errorCard('Only staff can decide infractions.'));

    const Infraction = require('../models/Infraction');
    const inf = await Infraction.findById(infractionId).catch(() => null);
    if (!inf) return interaction.update(errorCard('Infraction not found.'));
    const partner = await Partner.findOne({ _id: inf.partnerId, guildId }).catch(() => null);
    if (!partner) return interaction.update(errorCard('Partner not found.'));

    if (action === 'terminate') {
      // C2: Create new termination record, don't overwrite the strike
      await Infraction.create({
        guildId, partnerId: partner._id.toString(), type: 'termination',
        reason: 'Strike limit reached', issuedBy: interaction.user.id,
      });
      await Partner.findByIdAndUpdate(partner._id, { status: 'inactive' });
      await interaction.update(successCard(`**${partner.name}** has been terminated.`));
      await audit(guildId, interaction.user.id, 'infraction_terminate', 'partner', partner._id.toString(), { reason: 'Strike limit reached' });
    } else {
      // Dismiss: don't remove the strike, just mark decision
      await interaction.update(successCard(`Escalation dismissed for **${partner.name}**.`));
      await audit(guildId, interaction.user.id, 'infraction_dismiss', 'infraction', infractionId);
    }
  },

  async handleAppealDecision(interaction) {
    const action = interaction.customId.startsWith('appeal_accept:') ? 'accept' : 'reject';
    const infractionId = interaction.customId.split(':')[1];
    const { member, guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(member, cfg)) return interaction.reply(errorCard('Only staff can decide appeals.'));

    const Infraction = require('../models/Infraction');
    const Partner = require('../models/Partner');
    const inf = await Infraction.findById(infractionId).catch(() => null);
    if (!inf) return interaction.update(errorCard('Infraction not found.'));
    const partner = await Partner.findOne({ _id: inf.partnerId, guildId }).catch(() => null);
    if (!partner) return interaction.update(errorCard('Partner not found.'));

    if (action === 'reject') {
      const modal = new ModalBuilder().setCustomId(`appeal_reject_reason:${infractionId}`).setTitle('Reject Appeal');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Reason for rejection').setStyle(TextInputStyle.Paragraph).setRequired(true)
      ));
      return interaction.showModal(modal);
    }

    if (action === 'accept') {
      // C3: Accept → removed: true, recalculate status, DM representative
      await Infraction.findByIdAndUpdate(infractionId, { appealStatus: 'accepted', removed: true });
      const activeStrikes = await Infraction.countDocuments({ guildId, partnerId: partner._id.toString(), type: 'strike', removed: false, expired: false });
      const newStatus = updatePartnerStatus(partner, activeStrikes, cfg);
      if (partner.status !== newStatus) {
        await Partner.findByIdAndUpdate(partner._id, { status: newStatus });
      }
      try {
        const rep = await interaction.client.users.fetch(partner.representativeId);
        await rep.send(successCard(`Your appeal for the infraction on **${partner.name}** has been accepted. The infraction has been removed.`, false)).catch(() => {});
      } catch {}
      await interaction.update(successCard(`Appeal accepted — infraction removed for **${partner.name}**.`));
      await audit(guildId, interaction.user.id, 'appeal_accept', 'infraction', infractionId, { partnerId: partner._id.toString() });
    }
  },

  async handleAppealRejectReason(interaction) {
    const infractionId = interaction.customId.replace('appeal_reject_reason:', '');
    const reason = interaction.fields.getTextInputValue('reason');
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.reply(errorCard('Only staff can decide appeals.'));

    const Infraction = require('../models/Infraction');
    const Partner = require('../models/Partner');
    const inf = await Infraction.findById(infractionId).catch(() => null);
    if (!inf) return interaction.reply(errorCard('Infraction not found.'));
    const partner = await Partner.findOne({ _id: inf.partnerId, guildId }).catch(() => null);
    if (!partner) return interaction.reply(errorCard('Partner not found.'));

    await Infraction.findByIdAndUpdate(infractionId, { appealStatus: 'rejected', appealRejectReason: reason });
    try {
      const rep = await interaction.client.users.fetch(partner.representativeId);
      await rep.send(errorCard(`Your appeal for the infraction on **${partner.name}** has been rejected.\n\n**Reason:** ${reason}`, false)).catch(() => {});
    } catch {}
    await interaction.update(successCard(`Appeal rejected for **${partner.name}**.`));
    await audit(guildId, interaction.user.id, 'appeal_reject', 'infraction', infractionId, { partnerId: partner._id.toString(), reason });
  },
};
