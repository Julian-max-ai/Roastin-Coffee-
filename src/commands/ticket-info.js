'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard, partnerInfoCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-info')
    .setDescription('Ticket-Informationen anzeigen.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, channel } = interaction;
    const cfg = await GuildConfig.findOne({ guildId: guild.id });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Nur Staff.'));

    const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id });
    if (!ticket) return interaction.editReply(errorCard('Kein Ticket in diesem Channel.'));

    const desc = `**Ticket #${ticket.ticketNumber || '?'}**\n\n` +
      `Typ: ${ticket.typeId}\n` +
      `Status: ${ticket.status}\n` +
      `Priorität: ${ticket.priority}\n` +
      `Opener: <@${ticket.userId}>\n` +
      `Claimer: ${ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Unclaimed'}\n` +
      `Geöffnet: ${ticket.openedAt?.toISOString() || 'n/a'}\n` +
      `Geschlossen: ${ticket.closedAt?.toISOString() || 'n/a'}\n` +
      `Notizen: ${(ticket.notes || []).length}`;

    await interaction.editReply(successCard(desc));
  },
};
