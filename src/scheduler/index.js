'use strict';
const cron = require('node-cron');
const { ticketInactivityJob } = require('./jobs/ticketInactivity');
const { ticketCloseRequestJob } = require('./jobs/ticketCloseRequest');
const { ticketAutoCloseJob } = require('./jobs/ticketAutoClose');
const { closedTicketCleanupJob } = require('./jobs/closedTicketCleanup');
const { infractionExpiryJob } = require('./jobs/infractionExpiry');
const { reviewRemindersJob } = require('./jobs/reviewReminders');
const { eventRemindersJob } = require('./jobs/eventReminders');
const { anniversariesJob } = require('./jobs/anniversaries');
const { inviteHealthJob } = require('./jobs/inviteHealth');
const { weeklyEventDigestJob } = require('./jobs/weeklyEventDigest');
const { unclaimedSLAJob } = require('./jobs/unclaimedSLA');
const { pendingRenamesJob } = require('./jobs/pendingRenames');
const { run: runWeeklyPRReport } = require('./jobs/weeklyPRReport');
const { sendMonthlyReviews } = require('../commands/review');

// In-memory last-run timestamps per job per guild (for /doctor)
const lastRun = new Map(); // jobName -> guildId -> Date

function setLastRun(jobName, guildId) {
  if (!lastRun.has(jobName)) lastRun.set(jobName, new Map());
  lastRun.get(jobName).set(guildId, new Date());
}
function getLastRun(jobName, guildId) {
  return lastRun.has(jobName) ? lastRun.get(jobName).get(guildId) : null;
}

function startScheduler(client) {
  console.log('[scheduler] Starting automation jobs...');

  // Ticket inactivity reminder + auto-close — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    await ticketInactivityJob(client, setLastRun);
  });

  // Ticket close-request auto-close — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    await ticketCloseRequestJob(client, setLastRun);
  });

  // Ticket auto-close (inactivity) — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    await ticketAutoCloseJob(client, setLastRun);
  });

  // Closed ticket channel cleanup — every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    await closedTicketCleanupJob(client, setLastRun);
  });

  // Infraction expiry — hourly
  cron.schedule('0 * * * *', async () => {
    await infractionExpiryJob(setLastRun);
  });

  // Review reminders — daily 09:00 UTC
  cron.schedule('0 9 * * *', async () => {
    await reviewRemindersJob(client, setLastRun);
  });

  // Event reminders — every minute
  cron.schedule('* * * * *', async () => {
    await eventRemindersJob(client, setLastRun);
  });

  // Anniversaries — daily
  cron.schedule('0 10 * * *', async () => {
    await anniversariesJob(client, setLastRun);
  });

  // Invite health check — weekly (Sunday 08:00 UTC)
  cron.schedule('0 8 * * 0', async () => {
    await inviteHealthJob(client, setLastRun);
  });

  // Weekly event digest — Monday 09:00 UTC
  cron.schedule('0 9 * * 1', async () => {
    await weeklyEventDigestJob(client, setLastRun);
  });

  // Unclaimed SLA check — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await unclaimedSLAJob(client, setLastRun);
  });

  // Pending renames — every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    await pendingRenamesJob(client, setLastRun);
  });

  // Monthly review cron (existing)
  cron.schedule('0 9 1 * *', async () => {
    try {
      const count = await sendMonthlyReviews(client).catch(err => { console.error('[cron] monthly reviews:', err); return 0; });
      console.log(`[cron] Monthly reviews sent: ${count}`);
    } catch {}
  }, { timezone: 'UTC' });

  // Weekly PR report — Monday 10:00 UTC
  cron.schedule('0 10 * * 1', async () => {
    const GuildConfig = require('../models/GuildConfig');
    const configs = await GuildConfig.find({ logChannel: { $ne: null } }).catch(() => []);
    for (const cfg of configs) {
      await runWeeklyPRReport(client, cfg.guildId).catch(err => console.error('[weeklyPRReport]', err));
    }
  });

  console.log('[scheduler] All jobs scheduled.');
}

module.exports = { startScheduler, getLastRun };
