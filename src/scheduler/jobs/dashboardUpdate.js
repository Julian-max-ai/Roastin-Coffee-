'use strict';
const GuildConfig = require('../../models/GuildConfig');
const Ticket = require('../../models/Ticket');
const Partner = require('../../models/Partner');
const ReviewRequest = require('../../models/ReviewRequest');

async function run(client) {
  try {
    const configs = await GuildConfig.find({ dashboardMessageId: { $ne: null }, dashboardChannelId: { $ne: null } }).catch(() => []);
    for (const cfg of configs) {
      try {
        const ch = await client.channels.fetch(cfg.dashboardChannelId).catch(() => null);
        if (!ch) continue;
        const msg = await ch.messages.fetch(cfg.dashboardMessageId).catch(() => null);
        if (!msg) continue;

        const openTickets = await Ticket.countDocuments({ guildId: cfg.guildId, status: 'open' });
        const unclaimed = await Ticket.countDocuments({ guildId: cfg.guildId, status: 'open', claimedBy: null });
        const totalPartners = await Partner.countDocuments({ guildId: cfg.guildId, status: 'active' });
        const month = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const pendingReviews = await ReviewRequest.countDocuments({ guildId: cfg.guildId, month, status: 'pending' });

        const desc = `**Staff Dashboard**\n\n` +
          `🎫 Open Tickets: ${openTickets} (${unclaimed} unclaimed)\n` +
          `🤝 Active Partners: ${totalPartners}\n` +
          `📋 Pending Reviews: ${pendingReviews}\n` +
          `⏱️ Uptime: ${Math.floor(process.uptime() / 60)} min`;

        const { successCard } = require('../../ui');
        await msg.edit(successCard(desc)).catch(() => {});
      } catch {}
    }
  } catch (err) {
    console.error('[dashboardUpdate]', err.message);
  }
}

module.exports = { run };
