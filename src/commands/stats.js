'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const Ticket  = require('../models/Ticket');
const Infraction = require('../models/Infraction');
const ReviewSubmission = require('../models/ReviewSubmission');
const EventRequest = require('../models/EventRequest');
const { statsCard, errorCard } = require('../ui');
const { buildProgressBar } = require('../ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Show server statistics.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;

    const totalPartners   = await Partner.countDocuments({ guildId });
    const activePartners  = await Partner.countDocuments({ guildId, status: 'active' });
    const probationPartners = await Partner.countDocuments({ guildId, status: 'probation' });
    const openTickets     = await Ticket.countDocuments({ guildId, status: 'open' });
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ticketsThisMonth = await Ticket.countDocuments({ guildId, openedAt: { $gte: monthStart } });

    const ticketsWithReply = await Ticket.aggregate([
      { $match: { guildId, firstStaffReplyAt: { $ne: null } } },
      { $group: { _id: null, avgMs: { $avg: { $subtract: ['$firstStaffReplyAt', '$openedAt'] } } } },
    ]);
    const avgMs = ticketsWithReply.length > 0 ? ticketsWithReply[0].avgMs : 0;
    const avgFirstReply = avgMs > 0 ? `${Math.round(avgMs / 1000 / 60)} min` : 'n/a';

    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const submissions = await ReviewSubmission.countDocuments({ guildId, month });
    const partners = await Partner.countDocuments({ guildId });

    const activeInfractions = await Infraction.countDocuments({ guildId, removed: false, expired: false });

    const upcomingEvents = await EventRequest.countDocuments({ guildId, status: 'pending' });

    await interaction.editReply(statsCard({
      totalPartners,
      activePartners,
      probationPartners,
      openTickets,
      ticketsThisMonth,
      avgFirstReply,
      reviewDone: submissions,
      reviewTotal: partners,
      activeInfractions,
      upcomingEvents,
      uptime: process.uptime() > 86400
        ? `${Math.floor(process.uptime() / 86400)}d`
        : `${Math.floor(process.uptime() / 3600)}h`,
    }));
  },
};
