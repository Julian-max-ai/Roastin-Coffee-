'use strict';
const Infraction = require('../models/Infraction');
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');
const { card, logCard } = require('../ui');
const { EMOJI, COLORS } = require('../theme');
const { audit } = require('../utils/audit');

const SLEEP = 500;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function infractionExpiryJob(setLastRun) {
  const configs = await GuildConfig.find().catch(() => []);
  for (const cfg of configs) {
    try {
      setLastRun('infractionExpiry', cfg.guildId);
      const now = new Date();

      // Expire warnings
      const warningDays = cfg.automation.infractionExpiryWarning ?? 90;
      if (warningDays > 0) {
        const warningCutoff = new Date(Date.now() - warningDays * 24 * 60 * 60 * 1000);
        await Infraction.updateMany({
          guildId: cfg.guildId, type: 'warning', expired: false, removed: false,
          expiresAt: { $lt: now, $ne: null },
        }, { expired: true }).catch(() => {});
      }

      // Expire strikes
      const strikeDays = cfg.automation.infractionExpiryStrike ?? 180;
      if (strikeDays > 0) {
        const strikeCutoff = new Date(Date.now() - strikeDays * 24 * 60 * 60 * 1000);
        const expiredStrikes = await Infraction.find({
          guildId: cfg.guildId, type: 'strike', expired: false, removed: false,
          expiresAt: { $lt: now, $ne: null },
        }).catch(() => []);

        for (const strike of expiredStrikes) {
          try {
            await Infraction.findByIdAndUpdate(strike._id, { expired: true });
            // Recalculate partner status
            const partner = await Partner.findOne({ _id: strike.partnerId, guildId: cfg.guildId }).catch(() => null);
            if (partner) {
              const activeStrikes = await Infraction.countDocuments({
                guildId: cfg.guildId, partnerId: partner._id.toString(),
                type: 'strike', removed: false, expired: false,
              });
              const newStatus = activeStrikes >= 3 ? 'inactive' : activeStrikes >= 2 ? 'probation' : 'active';
              if (partner.status !== newStatus) {
                await Partner.findByIdAndUpdate(partner._id, { status: newStatus });
              }
            }
            await audit(cfg.guildId, null, 'infraction_expire', 'infraction', strike._id.toString());
          } catch (err) {
            console.error('[scheduler] infractionExpiry strike error:', err.message);
          }
          await sleep(SLEEP);
        }
      }
    } catch (err) {
      console.error('[scheduler] infractionExpiry guild error:', err.message);
    }
  }
}

module.exports = { infractionExpiryJob };
