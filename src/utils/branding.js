'use strict';
const GuildConfig = require('../models/GuildConfig');

async function getBranding(guildId) {
  if (!guildId) return null;
  const cfg = await GuildConfig.findOne({ guildId }).select('branding').catch(() => null);
  return cfg?.branding || null;
}

module.exports = { getBranding };
