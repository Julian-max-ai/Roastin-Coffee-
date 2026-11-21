'use strict';
const GuildConfig = require('../../models/GuildConfig');
const Partner = require('../../models/Partner');
const Infraction = require('../../models/Infraction');

async function run(client, guildId) {
  try {
    const cfg = await GuildConfig.findOne({ guildId });
    if (!cfg?.logChannel) return;
    const ch = await client.channels.fetch(cfg.logChannel).catch(() => null);
    if (!ch) return;

    const partners = await Partner.find({ guildId }).catch(() => []);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newInfractions = await Infraction.countDocuments({ guildId, createdAt: { $gte: weekAgo } });
    const activePartners = partners.filter(p => p.status === 'active').length;
    const terminated = partners.filter(p => p.status === 'terminated').length;

    const { EmbedBuilder } = require('discord.js');
    const embed = new EmbedBuilder()
      .setTitle('📊 Weekly PR Report')
      .setDescription(`**Active Partners:** ${activePartners}\n**Terminated:** ${terminated}\n**New Infractions (7d):** ${newInfractions}\n**Total Partners:** ${partners.length}`)
      .setColor(0x5865F2)
      .setTimestamp();
    await ch.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('[weeklyPRReport]', err.message);
  }
}

module.exports = { run };
