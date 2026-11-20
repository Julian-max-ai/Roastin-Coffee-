'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner    = require('../models/Partner');
const Infraction = require('../models/Infraction');
const GuildConfig = require('../models/GuildConfig');
const { infractionCard, infractionListCard, errorCard, successCard, logCard } = require('../ui');
const { cap, ts, strikeBar, truncate } = require('../utils/format');
const { paginate } = require('../utils/pagination');
const { EMOJI, STRIKE_LIMIT, PAGE_SIZE } = require('../theme');

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
    .addSubcommand(s => s.setName('list').setDescription('View active infractions for a partner.')
      .addStringOption(o => o.setName('partner').setDescription('Partner name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove an infraction.')
      .addStringOption(o => o.setName('id').setDescription('Infraction').setRequired(true).setAutocomplete(true))),

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

      const infraction = await Infraction.create({ guildId, partnerId: partner._id.toString(), type, reason, issuedBy: interaction.user.id });
      const activeStrikes = await Infraction.countDocuments({ guildId, partnerId: partner._id.toString(), type: 'strike', removed: false });

      let dmFailed = false;
      try {
        const rep = await interaction.client.users.fetch(partner.representativeId);
        const dmDesc =
          `**Partner:** ${partner.name}\n` +
          `**Type:** ${cap(type)}\n` +
          `**Reason:** ${reason}\n` +
          `**Date:** ${ts(infraction.issuedAt, 'D')}\n\n` +
          `> If you have questions, please contact Roastin' Coffee PR Staff.`;
        await rep.send(infractionCard(infraction, partner, interaction.user.id, activeStrikes, STRIKE_LIMIT));
      } catch { dmFailed = true; }

      const card = infractionCard(infraction, partner, interaction.user.id, activeStrikes, STRIKE_LIMIT, dmFailed);
      await interaction.editReply(card);

      if (cfg?.logChannel) {
        const ch = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
        if (ch) await ch.send(card).catch(() => {});
      }

      await audit(interaction.guildId, interaction.user.id, 'infraction_add', 'partner', partner._id.toString(), { type, reason });
    }

    if (sub === 'list') {
      const partnerName = interaction.options.getString('partner');
      const partner     = await Partner.findOne({ guildId, name: partnerName });
      if (!partner) return interaction.editReply(errorCard(`No partner named **${partnerName}** found.`));

      const all    = await Infraction.find({ guildId, partnerId: partner._id.toString(), removed: false });
      const strikes = all.filter(i => i.type === 'strike').length;
      const { items, totalPages, page, row } = paginate(all, 0, PAGE_SIZE, `infractions:${partner._id}`);
      const res = infractionListCard(partner, items, page, totalPages, strikes, STRIKE_LIMIT);
      if (row) res.components = [...res.components, row];
      await interaction.editReply(res);
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id');
      const infraction = await Infraction.findOneAndUpdate(
        { _id: id, guildId },
        { removed: true },
        { new: true }
      ).catch(() => null);

      if (!infraction) return interaction.editReply(errorCard('Infraction not found. Make sure you selected a valid entry.'));
      await interaction.editReply(successCard(`Infraction \`${id}\` has been removed.`));
    }
  },
};
