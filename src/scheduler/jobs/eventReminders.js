'use strict';
const EventRequest = require('../../models/EventRequest');
const GuildConfig = require('../../models/GuildConfig');
const { card, logCard } = require('../../ui');
const { EMOJI, COLORS } = require('../../theme');
const { audit } = require('../../utils/audit');

const SLEEP = 500;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function eventRemindersJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.eventReminderHours': { $gt: 0 } }).catch(() => []);
  const now = new Date();

  for (const cfg of configs) {
    try {
      setLastRun('eventReminders', cfg.guildId);
      const hours = cfg.automation.eventReminderHours ?? 1;
      const cutoff = new Date(Date.now() + hours * 60 * 60 * 1000);

      const events = await EventRequest.find({
        guildId: cfg.guildId, status: 'approved',
        startsAt: { $gte: now, $lte: cutoff },
        reminderSentAt: { $exists: false, $eq: null },
      }).catch(() => []);

      const announceChannel = cfg.announcementChannel ? await client.channels.fetch(cfg.announcementChannel).catch(() => null) : null;

      for (const event of events) {
        try {
          await EventRequest.findByIdAndUpdate(event._id, { reminderSentAt: new Date() });

          if (announceChannel) {
            await announceChannel.send(card({
              title: `${EMOJI.reminder} Event Reminder`,
              description: `**${event.title}** starts in ${hours} hour(s).\n${event.description}\n\n-# Hosted by <@${event.submitterId}>`,
              color: COLORS.warning,
              buttons: [],
              ephemeral: false,
            })).catch(() => {});
          }
        } catch (err) {
          console.error('[scheduler] eventReminder error:', err.message);
        }
        await sleep(SLEEP);
      }
    } catch (err) {
      console.error('[scheduler] eventReminders guild error:', err.message);
    }
  }
}

module.exports = { eventRemindersJob };
