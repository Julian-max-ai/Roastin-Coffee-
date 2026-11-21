'use strict';
const Ticket = require('../models/Ticket');
const { isStaff } = require('../utils/permissions');

// A5: Track ticket activity for stats and inactivity automation
// Uses a small in-memory map to avoid DB queries on every message
const ticketChannelMap = new Map(); // channelId -> { guildId, ticketId }

module.exports = {
  name: 'messageCreate',
  async execute(message, client) {
    if (!message.guild || message.author.bot) return;
    if (!message.channel.isTextBased()) return;

    const key = message.channel.id;
    let entry = ticketChannelMap.get(key);

    if (!entry) {
      const ticket = await Ticket.findOne({ guildId: message.guild.id, channelId: message.channel.id, status: 'open' }).catch(() => null);
      if (!ticket) return;
      entry = { guildId: message.guild.id, ticketId: ticket._id.toString() };
      ticketChannelMap.set(key, entry);
    }

    const now = new Date();
    const update = { lastActivityAt: now };

    // Set firstStaffReplyAt when a staff member replies first
    const member = message.member;
    if (member) {
      const cfg = await require('../models/GuildConfig').findOne({ guildId: message.guild.id }).catch(() => null);
      if (isStaff(member, cfg)) {
        const ticket = await Ticket.findById(entry.ticketId).catch(() => null);
        if (ticket && !ticket.firstStaffReplyAt) {
          update.firstStaffReplyAt = now;
        }
      }
    }

    await Ticket.findByIdAndUpdate(entry.ticketId, update).catch(() => {});
  },
};
