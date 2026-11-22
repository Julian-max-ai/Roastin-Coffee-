'use strict';
const EventRequest = require('../../models/EventRequest');
const GuildConfig = require('../../models/GuildConfig');
const { getText } = require('../../utils/texts');
const { card } = require('../../ui');
const { EMOJI, COLORS } = require('../../theme');

async function weeklyEventDigestJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.weeklyEventDigest': true }).catch(() => []);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  for (const cfg of configs) {
    try {
      setLastRun('weeklyEventDigest', cfg.guildId);
      const events = await EventRequest.find({
        guildId: cfg.guildId, status: 'approved',
        startsAt: { $gte: startOfWeek, $lte: endOfWeek },
      }).sort({ startsAt: 1 }).catch(() => []);

      if (!events.length) continue;

      const announceChannel = cfg.announcementChannel ? await client.channels.fetch(cfg.announcementChannel).catch(() => null) : null;
      if (!announceChannel) continue;

      let desc = '';
      for (const e of events) {
        desc += `• **${e.title}** — ${e.startsAt.toISOString()} UTC\n`;
      }

      await announceChannel.send(card({
        title: `${EMOJI.event} Weekly Event Digest`,
        description: getText(cfg, 'weekly_digest_header', {}) + `\n\n${desc}`,
        color: COLORS.primary,
        buttons: [],
        ephemeral: false,
      })).catch(() => {});
    } catch (err) {
      console.error('[scheduler] weeklyEventDigest guild error:', err.message);
    }
  }
}

module.exports = { weeklyEventDigestJob };
