'use strict';
const Ticket = require('../models/Ticket');
const { audit } = require('../utils/audit');

module.exports = {
  name: 'channelDelete',
  async execute(channel, client) {
    if (!channel.isTextBased() || !channel.guildId) return;

    // A4: Mark tickets whose channel was manually deleted as closed
    const ticket = await Ticket.findOne({ guildId: channel.guildId, channelId: channel.id, status: 'open' }).catch(() => null);
    if (ticket) {
      await Ticket.findByIdAndUpdate(ticket._id, { status: 'closed', closedBy: null, closedAt: new Date() });
      await audit(channel.guildId, null, 'ticket_deleted', 'ticket', ticket._id.toString(), { channelName: channel.name, reason: 'Channel manually deleted' });
    }
  },
};
