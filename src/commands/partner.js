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
      .addUserOption(o => o.setName('representative').setDescription('Partner representative').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('roblox').setDescription('New Roblox group link'))
      .addStringOption(o => o.setName('discord').setDescription('New Discord invite link'))
      .addUserOption(o => o.setName('representative').setDescription('New representative')))
    .addSubcommand(s => s.setName('list').setDescription('List all current partners.'))
    .addSubcommand(s => s.setName('info').setDescription('Show partner details.')
      .addStringOption(o => o.setName('name').setDescription('Partner name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('note').setDescription('Add a note to a partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('text').setDescription('Note text').setRequired(true))),

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

      if (!isRobloxLink(roblox)) return interaction.editReply(errorCard('Invalid Roblox link. Must contain `roblox.com/groups` or `roblox.com/communities`.'));
      if (!isDiscordInvite(disc)) return interaction.editReply(errorCard('Invalid Discord invite. Must be a `discord.gg/` or `discord.com/invite/` link.'));
      if (await Partner.findOne({ guildId, name })) return interaction.editReply(errorCard(`A partner named **${name}** already exists.`));

      const partner = await Partner.create({ guildId, name, robloxLink: roblox, discordInvite: disc, representativeId: rep.id });
      await interaction.editReply(partnerCard(partner));
      await updatePartnerList(interaction.client, guildId);
      await sendLog(interaction.client, guildId, `${EMOJI.partner} Partner Added`, `**${name}** added by <@${interaction.user.id}>`);
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

      const changes = [];
      if (interaction.options.getString('roblox')) {
        if (!isRobloxLink(interaction.options.getString('roblox'))) return interaction.editReply(errorCard('Invalid Roblox link.'));
        changes.push(`Roblox updated`);
        partner.robloxLink = interaction.options.getString('roblox');
      }
      if (interaction.options.getString('discord')) {
        if (!isDiscordInvite(interaction.options.getString('discord'))) return interaction.editReply(errorCard('Invalid Discord invite.'));
        changes.push(`Discord updated`);
        partner.discordInvite = interaction.options.getString('discord');
      }
      if (interaction.options.getUser('representative')) {
        changes.push(`Representative → <@${interaction.options.getUser('representative').id}>`);
        partner.representativeId = interaction.options.getUser('representative').id;
      }
      await partner.save();
      await interaction.editReply(successCard(`**${name}** updated:\n${changes.map(c => `> ${c}`).join('\n')}`));
      await updatePartnerList(interaction.client, guildId);
    }

    if (sub === 'list') {
      const all = await Partner.find({ guildId, status: { $ne: 'removed' } });
      if (!all.length) return interaction.editReply(errorCard('No partners found.'));
      const { items, totalPages, page, row } = paginate(all, 0, PAGE_SIZE, 'partners');
      let desc = `**${all.length} active partner(s)**\n\n`;
      for (const pt of items) {
        desc += `**${pt.name}** — <@${pt.representativeId}>\n> Since ${ts(pt.addedAt, 'D')}\n\n`;
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

    if (sub === 'note') {
      const name = interaction.options.getString('name');
      const text = interaction.options.getString('text');
      const partner = await Partner.findOne({ guildId, name });
      if (!partner) return interaction.editReply(errorCard(`No partner named **${name}** found.`));
      partner.notes = partner.notes || [];
      partner.notes.push({ text, by: interaction.user.id, date: new Date() });
      await partner.save();
      await interaction.editReply(successCard(`Note added to **${name}**.`));
    }
  },
};

async function updatePartnerList(client, guildId) {
  const cfg = await GuildConfig.findOne({ guildId });
  if (!cfg?.partnerListChannel) return;
  const channel = await client.channels.fetch(cfg.partnerListChannel).catch(() => null);
  if (!channel) return;

  const partners = await Partner.find({ guildId });
  const header   = cfg.partnerListText || `## ${EMOJI.partner} Our Partners\n\n`;
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
