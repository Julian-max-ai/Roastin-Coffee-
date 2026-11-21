'use strict';
const Partner = require('../../models/Partner');
const ReviewSubmission = require('../../models/ReviewSubmission');
const GuildConfig = require('../../models/GuildConfig');
const { card, logCard } = require('../../ui');
const { EMOJI, COLORS } = require('../../theme');
const { audit } = require('../../utils/audit');

const SLEEP = 500;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function reviewRemindersJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.reviewReminderDays': { $gt: 0 } }).catch(() => []);
  const now = new Date();

  for (const cfg of configs) {
    try {
      setLastRun('reviewReminders', cfg.guildId);
      const reminderDays = cfg.automation.reviewReminderDays ?? 7;
      const overdueDays = cfg.automation.reviewOverdueDays ?? 14;
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      const partners = await Partner.find({ guildId: cfg.guildId }).catch(() => []);
      const submissions = await ReviewSubmission.find({ guildId: cfg.guildId, month }).catch(() => []);
      const doneIds = new Set(submissions.map(s => s.partnerId.toString()));

      const channel = cfg.reviewChannel ? await client.channels.fetch(cfg.reviewChannel).catch(() => null) : null;

      for (const partner of partners) {
        try {
          if (doneIds.has(partner._id.toString())) continue;

          const partnerAdded = new Date(partner.addedAt);
          const daysSinceAdd = (now - partnerAdded) / (1000 * 60 * 60 * 24);

          if (daysSinceAdd >= overdueDays) {
            // Overdue: notify staff
            if (cfg.logChannel) {
              const logCh = await client.channels.fetch(cfg.logChannel).catch(() => null);
              if (logCh) {
                await logCh.send(card({
                  title: `${EMOJI.overdue} Review Overdue`,
                  description: `**${partner.name}** has not submitted their review for ${month} (${overdueDays}+ days overdue).`,
                  color: COLORS.error,
                  buttons: [],
                  ephemeral: false,
                })).catch(() => {});
              }
            }
          } else if (channel && daysSinceAdd >= reminderDays) {
            // Reminder
            await channel.send(card({
              title: `${EMOJI.reminder} Review Reminder`,
              description: `**${partner.name}**, please complete your monthly review for ${month}.` +
                (cfg.reviewMode === 'link' && cfg.reviewLink
                  ? `\nLink: ${cfg.reviewLink}`
                  : '\nUse the "Start Review" button on the review card.'),
              color: COLORS.warning,
              buttons: [],
              ephemeral: false,
            }), { allowedMentions: { users: [partner.representativeId] } }).catch(() => {});
          }
        } catch (err) {
          console.error('[scheduler] reviewReminder partner error:', err.message);
        }
        await sleep(SLEEP);
      }
    } catch (err) {
      console.error('[scheduler] reviewReminders guild error:', err.message);
    }
  }
}

module.exports = { reviewRemindersJob };
