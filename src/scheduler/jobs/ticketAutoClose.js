'use strict';
const Ticket = require('../../models/Ticket');
const GuildConfig = require('../../models/GuildConfig');
const { closeTicket } = require('../../services/ticketService');

async function ticketAutoCloseJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.ticketAutoCloseEnabled': true }).catch(() => []);
  const now = new Date();

  for (const cfg of configs) {
    try {
      setLastRun('ticketAutoClose', cfg.guildId);
      const hours = cfg.automation.ticketAutoCloseHours ?? 48;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      const tickets = await Ticket.find({
        guildId: cfg.guildId, status: 'open',
        lastActivityAt: { $lt: cutoff },
        reminderSentAt: { $ne: null },
      }).catch(() => []);

      for (const ticket of tickets) {
        try {
          await closeTicket(client, ticket._id.toString(), {
            closedBy: null,
            reason: 'Auto-closed due to inactivity',
            source: 'inactivity',
          });
        } catch (err) {
          console.error('[scheduler] ticketAutoClose error:', err.message);
        }
      }
    } catch (err) {
      console.error('[scheduler] ticketAutoClose guild error:', err.message);
    }
  }
}

module.exports = { ticketAutoCloseJob };
