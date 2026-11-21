'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats-staff')
    .setDescription('Staff-Statistiken.')
    .addUserOption(o => o.setName('user').setDescription('Staff-Mitglied').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await require('../models/GuildConfig').findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Nur Staff.'));

    const userId = interaction.options.getUser('user').id;
    const claimed = await Ticket.countDocuments({ guildId, claimedBy: userId });
    const closed = await Ticket.countDocuments({ guildId, closedBy: userId });

    const desc = `**Staff Stats: <@${userId}>**\n\n` +
      `🎫 Geclaimte Tickets: ${claimed}\n` +
      `✅ Geschlossene Tickets: ${closed}`;

    await interaction.editReply(successCard(desc));
  },
};
