'use strict';
const Ticket = require('../../models/Ticket');
const GuildConfig = require('../../models/GuildConfig');

async function closedTicketCleanupJob(client, setLastRun) {
  const configs = await GuildConfig.find().catch(() => []);
  const now = new Date();

  for (const cfg of configs) {
    try {
      setLastRun('closedTicketCleanup', cfg.guildId);
      const tickets = await Ticket.find({
        guildId: cfg.guildId, status: 'closed',
        deleteAt: { $lte: now, $ne: null },
      }).catch(() => []);

      for (const ticket of tickets) {
        try {
          const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
          if (channel) await channel.delete().catch(() => {});
          await Ticket.findByIdAndUpdate(ticket._id, { deleteAt: null, channelDeletedAt: new Date() });
        } catch (err) {
          console.error('[scheduler] closedTicketCleanup error:', err.message);
        }
      }
    } catch (err) {
      console.error('[scheduler] closedTicketCleanup guild error:', err.message);
    }
  }
}

module.exports = { closedTicketCleanupJob };
