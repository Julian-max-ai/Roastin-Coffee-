'use strict';
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const { card, logCard } = require('../ui');
const { EMOJI, COLORS } = require('../theme');
const { audit } = require('../utils/audit');

const SLEEP = 500;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ticketCloseRequestJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.ticketInactivityEnabled': true }).catch(() => []);
  for (const cfg of configs) {
    try {
      setLastRun('ticketCloseRequest', cfg.guildId);
      const hours = cfg.automation.ticketCloseRequestHours ?? 24;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      const tickets = await Ticket.find({
        guildId: cfg.guildId, status: 'open',
        closeRequestedAt: { $ne: null, $lt: cutoff },
      }).catch(() => []);

      for (const ticket of tickets) {
        try {
          const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
          if (!channel) continue;

          // Auto-close
          await Ticket.findByIdAndUpdate(ticket._id, {
            status: 'closed', closedAt: new Date(), closedBy: null,
            closedReason: 'Auto-closed: no response to close request',
          });
          await audit(cfg.guildId, null, 'ticket_close', 'ticket', ticket._id.toString(), { reason: 'Auto-closed: close request timeout' });

          try {
            await channel.send(card({
              title: `${EMOJI.close} Ticket Auto-Closed`,
              description: 'This ticket was automatically closed due to no response to the close request.',
              color: COLORS.warning,
              buttons: [],
              ephemeral: false,
            })).catch(() => {});
          } catch {}

          await channel.delete().catch(() => {});
        } catch (err) {
          console.error('[scheduler] ticketCloseRequest error:', err.message);
        }
        await sleep(SLEEP);
      }
    } catch (err) {
      console.error('[scheduler] ticketCloseRequest guild error:', err.message);
    }
  }
}

module.exports = { ticketCloseRequestJob };
