'use strict';
const Partner = require('../../models/Partner');
const ReviewSubmission = require('../../models/ReviewSubmission');
const ReviewRequest = require('../../models/ReviewRequest');
const GuildConfig = require('../../models/GuildConfig');
const { card, logCard } = require('../../ui');
const { EMOJI, COLORS } = require('../../theme');
const { audit } = require('../../utils/audit');
const { getText } = require('../../utils/texts');

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

      const requests = await ReviewRequest.find({ guildId: cfg.guildId, month }).catch(() => []);
      const reqMap = new Map(requests.map(r => [r.partnerId.toString(), r]));
      const submissions = await ReviewSubmission.find({ guildId: cfg.guildId, month }).catch(() => []);
      const doneIds = new Set(submissions.map(s => s.partnerId.toString()));

      for (const partner of partners) {
        try {
          const rr = reqMap.get(partner._id.toString());
          if (!rr) continue;
          if (doneIds.has(partner._id.toString())) continue;
          if (rr.status === 'done' || rr.status === 'skipped') continue;

          const reqAge = (now - new Date(rr.createdAt)) / (1000 * 60 * 60 * 24);

          // Resolve partner channel
          const partnerCh = partner.channelId ? await client.channels.fetch(partner.channelId).catch(() => null) : null;
          if (!partnerCh) continue;

          if (reqAge >= overdueDays && !rr.overdueAt) {
            // Overdue: notify staff
            if (cfg.logChannel) {
              const logCh = await client.channels.fetch(cfg.logChannel).catch(() => null);
              if (logCh) {
                await ReviewRequest.findByIdAndUpdate(rr._id, { overdueAt: now });
                await logCh.send(card({
                  title: `${EMOJI.overdue} Review Overdue`,
                  description: `**${partner.name}** has not submitted their review for ${month} (${overdueDays}+ days overdue).`,
                  color: COLORS.error,
                  buttons: [],
                  ephemeral: false,
                })).catch(() => {});
              }
            }
          } else if (partnerCh && reqAge >= reminderDays && !rr.remindedAt) {
            // Reminder
            await ReviewRequest.findByIdAndUpdate(rr._id, { remindedAt: now });
            await partnerCh.send({ ...card({
              title: `${EMOJI.reminder} Review Reminder`,
              description: getText(cfg, 'review_reminder', { partner: partner.name, rep: `<@${partner.representativeId}>`, month }) +
                (cfg.reviewMode === 'link' && cfg.reviewLink
                  ? `\nLink: ${cfg.reviewLink}`
                  : '\nUse the "Start Review" button on the review card.'),
              color: COLORS.warning,
              buttons: [],
              ephemeral: false,
            }), allowedMentions: { users: [partner.representativeId] } }).catch(() => {});
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
