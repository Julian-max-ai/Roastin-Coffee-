'use strict';
const Partner = require('../../models/Partner');
const GuildConfig = require('../../models/GuildConfig');
const { card } = require('../../ui');
const { EMOJI, COLORS } = require('../../theme');

const SLEEP = 500;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function anniversariesJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.anniversaryAnnouncements': true }).catch(() => []);
  const now = new Date();
  const currentYear = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  for (const cfg of configs) {
    try {
      setLastRun('anniversaries', cfg.guildId);
      const partners = await Partner.find({ guildId: cfg.guildId }).catch(() => []);

      const announceChannel = cfg.announcementChannel ? await client.channels.fetch(cfg.announcementChannel).catch(() => null) : null;
      if (!announceChannel) continue;

      for (const partner of partners) {
        try {
          const added = new Date(partner.addedAt);
          if (added.getMonth() !== month || added.getDate() !== day) continue;
          if (partner.anniversaryNotifiedYear === currentYear) continue;

          await announceChannel.send(card({
            title: `${EMOJI.anniversary} Partner Anniversary`,
            description: `Happy anniversary to **${partner.name}**! 🎉 Thank you for partnering with Roastin' Coffee.\nPing: <@${partner.representativeId}>`,
            color: COLORS.success,
            buttons: [],
            ephemeral: false,
          }), { allowedMentions: { users: [partner.representativeId] } }).catch(() => {});

          await Partner.findByIdAndUpdate(partner._id, { anniversaryNotifiedYear: currentYear });
        } catch (err) {
          console.error('[scheduler] anniversary error:', err.message);
        }
        await sleep(SLEEP);
      }
    } catch (err) {
      console.error('[scheduler] anniversaries guild error:', err.message);
    }
  }
}

module.exports = { anniversariesJob };
