'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-blacklist')
    .setDescription('Ticket creation blacklist.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('add').setDescription('Blacklist user.')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove user from blacklist.')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('Show blacklist.')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const sub = interaction.options.getSubcommand();
    const blacklist = cfg?.ticketBlacklist || [];

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      if (blacklist.find(b => b.userId === user.id)) return interaction.editReply(errorCard('User is already blacklisted.'));
      blacklist.push({ userId: user.id, reason, addedBy: interaction.user.id, addedAt: new Date() });
      await GuildConfig.findOneAndUpdate({ guildId }, { ticketBlacklist: blacklist }, { upsert: true });
      await require('../utils/audit').audit(guildId, interaction.user.id, 'ticket_blacklist_add', 'user', user.id, { reason });
      return interaction.editReply(successCard(`**${user.tag}** was blacklisted.`));
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      const filtered = blacklist.filter(b => b.userId !== user.id);
      await GuildConfig.findOneAndUpdate({ guildId }, { ticketBlacklist: filtered }, { upsert: true });
      await require('../utils/audit').audit(guildId, interaction.user.id, 'ticket_blacklist_remove', 'user', user.id);
      return interaction.editReply(successCard(`**${user.tag}** wurde von der Blacklist removed.`));
    }

    if (sub === 'list') {
      if (!blacklist.length) return interaction.editReply(errorCard('Blacklist is empty.'));
      const desc = blacklist.map(b => `<@${b.userId}> — ${b.reason}`).join('\n');
      return interaction.editReply(successCard(desc));
    }
  },
};
