'use strict';
const Ticket = require('../../models/Ticket');
const { audit } = require('../../utils/audit');

const SLEEP = 500;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function closedTicketCleanupJob(client, setLastRun) {
  const configs = await require('../../models/GuildConfig').find().catch(() => []);
  for (const cfg of configs) {
    try {
      setLastRun('closedTicketCleanup', cfg.guildId);
      const tickets = await Ticket.find({ guildId: cfg.guildId, status: 'closed' }).catch(() => []);

      for (const ticket of tickets) {
        try {
          const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
          if (channel) {
            // Channel still exists — delete it
            await channel.delete().catch(() => {});
          }
        } catch (err) {
          console.error('[scheduler] closedTicketCleanup error:', err.message);
        }
        await sleep(SLEEP);
      }
    } catch (err) {
      console.error('[scheduler] closedTicketCleanup guild error:', err.message);
    }
  }
}

module.exports = { closedTicketCleanupJob };
