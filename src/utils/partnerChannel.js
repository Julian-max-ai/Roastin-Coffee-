'use strict';
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');

async function resolvePartnerChannel(guild, partner, cfg) {
  if (partner?.channelId) {
    const ch = await guild.channels.fetch(partner.channelId).catch(() => null);
    if (ch) return ch;
    // Channel deleted
    await Partner.findByIdAndUpdate(partner._id, { channelMissing: true }).catch(() => {});
  }
  if (cfg?.reviewChannel) {
    const ch = await guild.channels.fetch(cfg.reviewChannel).catch(() => null);
    if (ch) return ch;
  }
  return null;
}

async function sendToPartner(guild, partner, cfg, payload, { pingReps = false } = {}) {
  const channel = await resolvePartnerChannel(guild, partner, cfg);
  if (!channel) {
    // Fallback to log channel
    if (cfg?.logChannel) {
      const logCh = await guild.channels.fetch(cfg.logChannel).catch(() => null);
      if (logCh) await logCh.send(payload).catch(() => {});
    }
    await Partner.findByIdAndUpdate(partner._id, { channelMissing: true }).catch(() => {});
    return null;
  }
  const reps = partner.representativeIds?.length ? partner.representativeIds : [partner.representativeId];
  const sendOpts = { ...payload };
  if (pingReps && reps.length) {
    sendOpts.content = reps.map(r => `<@${r}>`).join(' ');
    sendOpts.allowedMentions = { users: reps };
  }
  await channel.send(sendOpts).catch(() => {});
  return channel;
}

module.exports = { resolvePartnerChannel, sendToPartner };
