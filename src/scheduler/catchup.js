'use strict';
const ReviewRequest = require('../models/ReviewRequest');
const { sendMonthlyReviews } = require('../commands/review');

async function runCatchup(client) {
  try {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const configs = await require('../models/GuildConfig').find({ reviewChannel: { $ne: null } }).catch(() => []);
    
    for (const cfg of configs) {
      try {
        // Check if monthly review was sent this month
        const existing = await ReviewRequest.countDocuments({ guildId: cfg.guildId, month });
        if (existing === 0 && now.getDate() <= 3) {
          console.log(`[catchup] Sending missed monthly reviews for guild ${cfg.guildId}`);
          await sendMonthlyReviews(client, cfg.guildId).catch(err => console.error('[catchup]', err));
        }
      } catch (err) {
        console.error('[catchup] guild error:', err.message);
      }
    }
  } catch (err) {
    console.error('[catchup] error:', err.message);
  }
}

module.exports = { runCatchup };
