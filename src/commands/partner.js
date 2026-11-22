'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const Partner     = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard, partnerCard, partnerListCards, infoCard, logCard, partnerInfoCard, card } = require('../ui');
const { isRobloxLink, isDiscordInvite, ts } = require('../utils/format');
const { paginate } = require('../utils/pagination');
const { isStaff } = require('../utils/permissions');
const { EMOJI, PAGE_SIZE, COLORS } = require('../theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Manage Roastin Coffee partners.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('add').setDescription('Add a new partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner group name').setRequired(true))
      .addStringOption(o => o.setName('roblox').setDescription('Roblox group link').setRequired(true))
      .addStringOption(o => o.setName('discord').setDescription('Discord invite link').setRequired(true))
      .addUserOption(o => o.setName('representative').setDescription('Partner representative').setRequired(true))
      .addChannelOption(o => o.setName('channel').setDescription('Partner channel (private)').setRequired(true))
      .addUserOption(o => o.setName('representative2').setDescription('Second representative (optional)'))
      .addUserOption(o => o.setName('representative3').setDescription('Third representative (optional)')))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('roblox').setDescription('New Roblox group link'))
      .addStringOption(o => o.setName('discord').setDescription('New Discord invite link'))
      .addChannelOption(o => o.setName('channel').setDescription('New partner channel'))
      .addUserOption(o => o.setName('add-rep').setDescription('Add a representative'))
      .addUserOption(o => o.setName('remove-rep').setDescription('Remove a representative')))
    .addSubcommand(s => s.setName('list').setDescription('List all current partners.'))
    .addSubcommand(s => s.setName('info').setDescription('Show partner details.')
      .addStringOption(o => o.setName('name').setDescription('Partner name').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const partners = await Partner.find({ guildId: interaction.guildId });
    const focused  = interaction.options.getFocused().toLowerCase();
    await interaction.respond(
      partners.filter(p => p.name.toLowerCase().includes(focused)).slice(0, 25).map(p => ({ name: p.name, value: p.name }))
    );
  },

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const name   = interaction.options.getString('name');
      const roblox = interaction.options.getString('roblox');
      const disc   = interaction.options.getString('discord');
      const rep    = interaction.options.getUser('representative');
      const channel = interaction.options.getChannel('channel');
      const rep2   = interaction.options.getUser('representative2');
      const rep3   = interaction.options.getUser('representative3');

      if (!isRobloxLink(roblox)) return interaction.editReply(errorCard('Invalid Roblox link. Must contain `roblox.com/groups` or `roblox.com/communities`.'));
      if (!isDiscordInvite(disc)) return interaction.editReply(errorCard('Invalid Discord invite. Must be a `discord.gg/` or `discord.com/invite/` link.'));
      if (await Partner.findOne({ guildId, name: { $regex: new RegExp(`^${name}$`, 'i') } })) return interaction.editReply(errorCard(`A partner named **${name}** already exists.`));
      if (await Partner.findOne({ guildId, channelId: channel.id })) return interaction.editReply(errorCard('This channel is already assigned to another partner.'));

      const reps = [rep.id];
      if (rep2) reps.push(rep2.id);
      if (rep3) reps.push(rep3.id);

      // Check bot permissions
      const me = await interaction.guild.members.fetch(interaction.client.user.id).catch(() => null);
      if (!me?.permissions.has(PermissionFlagsBits.ManageChannels) || !me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.editReply(errorCard('Bot needs Manage Channels and Manage Roles permissions.'));
      }

      // Set channel permissions
      try {
        await channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
        for (const r of reps) {
          await channel.permissionOverwrites.edit(r, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
        }
        const cfg = await GuildConfig.findOne({ guildId });
        for (const roleId of [...(cfg?.prStaffRoles || []), ...(cfg?.adminRoles || [])]) {
          await channel.permissionOverwrites.edit(roleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, ManageMessages: true });
        }
        await channel.permissionOverwrites.edit(interaction.client.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, EmbedLinks: true, ManageMessages: true });
      } catch (err) {
        return interaction.editReply(errorCard(`Failed to set channel permissions: ${err.message}`));
      }

      const partner = await Partner.create({
        guildId, name, robloxLink: roblox, discordInvite: disc,
        representativeId: rep.id, representativeIds: reps,
        channelId: channel.id,
      });

      // Auto-assign rep role
      const cfg = await GuildConfig.findOne({ guildId });
      let roleAssigned = false;
      let roleError = null;
      if (cfg?.automation?.autoAssignRepRoles && cfg?.partnerRepRoles?.length) {
        for (const repId of reps) {
          try {
            const member = await interaction.guild.members.fetch(repId);
            await member.roles.add(cfg.partnerRepRoles);
            roleAssigned = true;
          } catch (err) {
            roleError = err.message;
          }
        }
      }

      // Welcome card in partner channel
      const { getText } = require('../utils/texts');
      const welcomeDesc = getText(cfg, 'partner_welcome', { partner: name, rep: reps.map(r => `<@${r}>`).join(', '), reps: reps.map(r => `<@${r}>`).join(', ') });
      const { card: cardFn, successCard: sc } = require('../ui');
      const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Roblox Group').setStyle(ButtonStyle.Link).setURL(roblox),
        new ButtonBuilder().setLabel('Discord Server').setStyle(ButtonStyle.Link).setURL(disc),
      );
      await channel.send(cardFn({ title: `🤝 Welcome, ${name}!`, description: welcomeDesc + '\n\nMonthly reviews, infraction notices and announcements for your partnership are posted here.', color: require('../theme').COLORS.primary, buttons: [new ButtonBuilder().setLabel('Roblox Group').setStyle(ButtonStyle.Link).setURL(roblox), new ButtonBuilder().setLabel('Discord Server').setStyle(ButtonStyle.Link).setURL(disc)], ephemeral: false })).catch(() => {});

      await updatePartnerList(interaction.client, guildId);
      await sendLog(interaction.client, guildId, `${EMOJI.partner} Partner Added`, `**${name}** added by <@${interaction.user.id}>`);

      const resultDesc = `**Partner:** ${name}\n**Channel:** <#${channel.id}>\n**Reps:** ${reps.map(r => `<@${r}>`).join(', ')}\n**Rep Role:** ${roleAssigned ? '✅ Assigned' : '❌ ' + (roleError || 'Not configured')}`;
      await interaction.editReply(successCard(resultDesc));
    }

    if (sub === 'remove') {
      const name    = interaction.options.getString('name');
      const partner = await Partner.findOne({ guildId, name });
      if (!partner) return interaction.editReply(errorCard(`No partner named **${name}** found.`));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`partner_confirm_remove:${partner._id}`).setLabel('Remove').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('partner_cancel_remove').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
      );
      await interaction.editReply(card({ title: `${EMOJI.error} Confirm Removal`, description: `Are you sure you want to remove **${name}**? This cannot be undone.`, color: COLORS.warning, buttons: [
        new ButtonBuilder().setCustomId(`partner_confirm_remove:${partner._id}`).setLabel('Remove').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('partner_cancel_remove').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
      ], ephemeral: true }));
    }

    if (sub === 'edit') {
      const name    = interaction.options.getString('name');
      const partner = await Partner.findOne({ guildId, name });
      if (!partner) return interaction.editReply(errorCard(`No partner named **${name}** found.`));

      const reps = partner.representativeIds?.length ? [...partner.representativeIds] : [partner.representativeId].filter(Boolean);
      const changes = [];

      if (interaction.options.getString('roblox')) {
        if (!isRobloxLink(interaction.options.getString('roblox'))) return interaction.editReply(errorCard('Invalid Roblox link.'));
        changes.push('Roblox updated');
        partner.robloxLink = interaction.options.getString('roblox');
      }
      if (interaction.options.getString('discord')) {
        if (!isDiscordInvite(interaction.options.getString('discord'))) return interaction.editReply(errorCard('Invalid Discord invite.'));
        changes.push('Discord updated');
        partner.discordInvite = interaction.options.getString('discord');
      }

      // channel change
      const newChannel = interaction.options.getChannel('channel');
      if (newChannel) {
        const me = await interaction.guild.members.fetch(interaction.client.user.id).catch(() => null);
        if (!me?.permissions.has(PermissionFlagsBits.ManageChannels)) return interaction.editReply(errorCard('Bot needs Manage Channels permission.'));
        try {
          if (partner.channelId) {
            const oldCh = await interaction.client.channels.fetch(partner.channelId).catch(() => null);
            if (oldCh) for (const r of reps) await oldCh.permissionOverwrites.delete(r).catch(() => {});
          }
          await newChannel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
          for (const r of reps) await newChannel.permissionOverwrites.edit(r, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true });
          const cfg = await GuildConfig.findOne({ guildId });
          for (const roleId of [...(cfg?.prStaffRoles || []), ...(cfg?.adminRoles || [])]) await newChannel.permissionOverwrites.edit(roleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true, ManageMessages: true });
          await newChannel.permissionOverwrites.edit(interaction.client.user.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, EmbedLinks: true, ManageMessages: true });
        } catch (err) {
          return interaction.editReply(errorCard(`Failed to set channel permissions: ${err.message}`));
        }
        partner.channelId = newChannel.id;
        partner.channelMissing = false;
        changes.push(`Channel → <#${newChannel.id}>`);
      }

      // add rep
      const addRep = interaction.options.getUser('add-rep');
      if (addRep && !reps.includes(addRep.id)) {
        reps.push(addRep.id);
        if (partner.channelId) {
          const ch = await interaction.client.channels.fetch(partner.channelId).catch(() => null);
          if (ch) await ch.permissionOverwrites.edit(addRep.id, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AttachFiles: true }).catch(() => {});
        }
        const cfg = await GuildConfig.findOne({ guildId });
        if (cfg?.automation?.autoAssignRepRoles && cfg?.partnerRepRoles?.length) {
          try { const m = await interaction.guild.members.fetch(addRep.id); await m.roles.add(cfg.partnerRepRoles); } catch {}
        }
        changes.push(`Added rep <@${addRep.id}>`);
      }

      // remove rep
      const removeRep = interaction.options.getUser('remove-rep');
      if (removeRep) {
        const idx = reps.indexOf(removeRep.id);
        if (idx === -1) return interaction.editReply(errorCard('That user is not a representative.'));
        if (reps.length <= 1) return interaction.editReply(errorCard('A partner must have at least one representative.'));
        reps.splice(idx, 1);
        if (partner.channelId) {
          const ch = await interaction.client.channels.fetch(partner.channelId).catch(() => null);
          if (ch) await ch.permissionOverwrites.delete(removeRep.id).catch(() => {});
        }
        changes.push(`Removed rep <@${removeRep.id}>`);
      }

      partner.representativeIds = reps;
      partner.representativeId = reps[0];
      await partner.save();

      await interaction.editReply(successCard(`**${name}** updated:\n${changes.length ? changes.map(c => `> ${c}`).join('\n') : '> No changes.'}`));
      await updatePartnerList(interaction.client, guildId);
    }

    if (sub === 'list') {
      const all = await Partner.find({ guildId, status: { $ne: 'removed' } });
      if (!all.length) return interaction.editReply(errorCard('No partners found.'));
      const { items, totalPages, page, row } = paginate(all, 0, PAGE_SIZE, 'partners');
      let desc = `**${all.length} active partner(s)**\n\n`;
      for (const pt of items) {
        const reps = pt.representativeIds?.length ? pt.representativeIds : [pt.representativeId];
        desc += `**${pt.name}** — ${reps.map(r => `<@${r}>`).join(', ')}${pt.channelId ? '' : ' ⚠️ no channel'}\n> Since ${ts(pt.addedAt, 'D')}\n\n`;
      }
      if (totalPages > 1) desc += `-# Page ${page + 1}/${totalPages}`;
      const res = infoCard(`${EMOJI.partner} Partner List`, desc, true);
      if (row) res.components = [...res.components, row];
      await interaction.editReply(res);
    }

    if (sub === 'info') {
      const name = interaction.options.getString('name');
      const partner = await Partner.findOne({ guildId, name });
      if (!partner) return interaction.editReply(errorCard(`No partner named **${name}** found.`));
      await interaction.editReply(partnerInfoCard(partner));
    }


  },
};

async function updatePartnerList(client, guildId) {
  const cfg = await GuildConfig.findOne({ guildId });
  if (!cfg?.partnerListChannel) return;
  const channel = await client.channels.fetch(cfg.partnerListChannel).catch(() => null);
  if (!channel) return;

  const partners = await Partner.find({ guildId });
  const { getText } = require('../utils/texts');
  const header   = getText(cfg, 'partner_list_header', {}) || cfg.partnerListText || `## ${EMOJI.partner} Our Partners\n\n`;
  const payloads = partners.length
    ? partnerListCards(partners, header)
    : [infoCard(`${EMOJI.partner} Our Partners`, '*No active partners yet.*', false)];

  const oldIds = [...(cfg.partnerListMessageIds || []), cfg.partnerListMessageId].filter(Boolean);
  for (const id of oldIds) await channel.messages.delete(id).catch(() => {});

  const newIds = [];
  for (const p of payloads) {
    const msg = await channel.send(p).catch(() => null);
    if (msg) newIds.push(msg.id);
  }
  await GuildConfig.findOneAndUpdate({ guildId }, { partnerListMessageIds: newIds, partnerListMessageId: null });
}

async function sendLog(client, guildId, title, description) {
  const cfg = await GuildConfig.findOne({ guildId });
  if (!cfg?.logChannel) return;
  const ch = await client.channels.fetch(cfg.logChannel).catch(() => null);
  if (ch) await ch.send(logCard(title, description)).catch(() => {});
}

async function handlePartnerRemoveConfirm(interaction) {
  const partnerId = interaction.customId.split(':')[1];
  const { guildId, member } = interaction;

  const cfg = await GuildConfig.findOne({ guildId });
  if (!isStaff(member, cfg)) {
    return interaction.reply(errorCard('Only staff can remove partners.'));
  }

  const partner = await Partner.findOneAndDelete({ _id: partnerId, guildId });
  if (!partner) return interaction.update(errorCard('Partner not found.'));

  await interaction.update(successCard(`**${partner.name}** has been removed.`));
  await updatePartnerList(interaction.client, guildId);
  await sendLog(interaction.client, guildId, `🗑️ Partner Removed`, `**${partner.name}** removed by <@${interaction.user.id}>`);
}

module.exports.updatePartnerList = updatePartnerList;
module.exports.sendLog = sendLog;
module.exports.handlePartnerRemoveConfirm = handlePartnerRemoveConfirm;
