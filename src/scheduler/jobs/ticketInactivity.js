'use strict';
const Ticket = require('../../models/Ticket');
const GuildConfig = require('../../models/GuildConfig');
const Partner = require('../../models/Partner');
const { card, warningCard, errorCard, logCard } = require('../../ui');
const { EMOJI, COLORS } = require('../../theme');
const { audit } = require('../../utils/audit');
const { ts } = require('../../utils/format');

const SLEEP = 500;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function ticketInactivityJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.ticketInactivityEnabled': true }).catch(() => []);
  for (const cfg of configs) {
    try {
      setLastRun('ticketInactivity', cfg.guildId);
      const hours = cfg.automation.ticketInactivityHours ?? 24;
      const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

      const tickets = await Ticket.find({
        guildId: cfg.guildId, status: 'open',
        lastActivityAt: { $lt: cutoff },
        reminderSentAt: { $exists: false, $eq: null },
      }).catch(() => []);

      for (const ticket of tickets) {
        try {
          const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
          if (!channel) continue;

          const creator = await client.users.fetch(ticket.userId).catch(() => null);
          const { getText } = require('../../utils/texts');
          await channel.send({ ...card({
            title: `${EMOJI.reminder} Ticket Inactivity Reminder`,
            description: getText(cfg, 'ticket_inactivity_reminder', { user: `<@${ticket.userId}>`, ticket: ticket._id, hours }) +
              (creator ? `\nPing: <@${ticket.userId}>` : ''),
            color: COLORS.warning,
            buttons: [],
            ephemeral: false,
          }), allowedMentions: { users: ticket.userId ? [ticket.userId] : [] } }).catch(() => {});

          await Ticket.findByIdAndUpdate(ticket._id, { reminderSentAt: new Date() });
        } catch (err) {
          console.error('[scheduler] ticketInactivity error:', err.message);
        }
        await sleep(SLEEP);
      }
    } catch (err) {
      console.error('[scheduler] ticketInactivity guild error:', err.message);
    }
  }
}

module.exports = { ticketInactivityJob };
