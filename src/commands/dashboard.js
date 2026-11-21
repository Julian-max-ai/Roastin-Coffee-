'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket');
const Partner = require('../models/Partner');
const ReviewRequest = require('../models/ReviewRequest');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('Staff-Dashboard (offene Tickets, Reviews, Strikes).')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await require('../models/GuildConfig').findOne({ guildId });

    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Nur Staff.'));

    const openTickets = await Ticket.countDocuments({ guildId, status: 'open' });
    const unclaimed = await Ticket.countDocuments({ guildId, status: 'open', claimedBy: null });
    const totalPartners = await Partner.countDocuments({ guildId, status: 'active' });
    const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const pendingReviews = await ReviewRequest.countDocuments({ guildId, month, status: 'pending' });

    const desc = `**Staff Dashboard**\n\n` +
      `🎫 Open Tickets: ${openTickets} (${unclaimed} unclaimed)\n` +
      `🤝 Active Partners: ${totalPartners}\n` +
      `📋 Pending Reviews: ${pendingReviews}\n` +
      `⏱️ Uptime: ${Math.floor(process.uptime() / 60)} min`;

    await interaction.editReply(successCard(desc));
  },
};
