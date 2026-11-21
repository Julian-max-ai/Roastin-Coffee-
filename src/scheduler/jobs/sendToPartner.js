'use strict';
const GuildConfig = require('../../models/GuildConfig');
const Partner = require('../../models/Partner');
const ReviewRequest = require('../../models/ReviewRequest');

async function run(client) {
  try {
    const configs = await GuildConfig.find({ reviewChannel: { $ne: null } }).catch(() => []);
    for (const cfg of configs) {
      try {
        const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const pending = await ReviewRequest.find({ guildId: cfg.guildId, month, status: 'approved' }).catch(() => []);
        for (const rr of pending) {
          const partner = await Partner.findById(rr.partnerId).catch(() => null);
          if (!partner?.channelId) continue;
          const ch = await client.channels.fetch(partner.channelId).catch(() => null);
          if (!ch) continue;
          const { successCard } = require('../../ui');
          await ch.send(successCard(`Your monthly review has been approved and is ready to be posted.`)).catch(() => {});
          await ReviewRequest.findByIdAndUpdate(rr._id, { status: 'sent' });
        }
      } catch {}
    }
  } catch (err) {
    console.error('[sendToPartner]', err.message);
  }
}

module.exports = { run };
