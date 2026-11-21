'use strict';
const Ticket = require('../../models/Ticket');
const GuildConfig = require('../../models/GuildConfig');
const { syncTicketChannel } = require('../../utils/ticketNaming');

async function pendingRenamesJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.ticketRenameOnClaim': { $ne: false } }).catch(() => []);

  for (const cfg of configs) {
    try {
      setLastRun('pendingRenames', cfg.guildId);
      const tickets = await Ticket.find({ guildId: cfg.guildId, status: 'open', pendingRename: true }).catch(() => []);

      for (const ticket of tickets) {
        try {
          const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
          if (!channel) continue;
          const typeKey = ticket.typeId || 'general';
          await syncTicketChannel(channel, ticket, typeKey);
          await Ticket.findByIdAndUpdate(ticket._id, { pendingRename: false });
        } catch (err) {
          console.error('[scheduler] pendingRenames error:', err.message);
        }
      }
    } catch (err) {
      console.error('[scheduler] pendingRenames guild error:', err.message);
    }
  }
}

module.exports = { pendingRenamesJob };
