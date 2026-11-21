'use strict';
const Ticket = require('../../models/Ticket');
const GuildConfig = require('../../models/GuildConfig');

async function unclaimedSLAJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.unclaimedAlertMinutes': { $gt: 0 } }).catch(() => []);
  const now = new Date();

  for (const cfg of configs) {
    try {
      setLastRun('unclaimedSLA', cfg.guildId);
      const minutes = cfg.automation.unclaimedAlertMinutes ?? 30;
      const cutoff = new Date(Date.now() - minutes * 60 * 1000);

      const tickets = await Ticket.find({
        guildId: cfg.guildId, status: 'open', claimedBy: null,
        openedAt: { $lt: cutoff },
        unclaimedAlertSentAt: { $exists: false, $eq: null },
      }).catch(() => []);

      const alertChannel = cfg.staffAlertChannel ? await client.channels.fetch(cfg.staffAlertChannel).catch(() => null) : null;
      const pingRole = cfg.automation.unclaimedAlertRole || null;

      for (const ticket of tickets) {
        try {
          if (alertChannel) {
            await alertChannel.send({
              content: `${pingRole ? `<@&${pingRole}> ` : ''}⏰ Ticket <#${ticket.channelId}> is unclaimed for ${minutes}+ minutes!`,
              allowedMentions: { roles: pingRole ? [pingRole] : [] },
            }).catch(() => {});
          }
          await Ticket.findByIdAndUpdate(ticket._id, { unclaimedAlertSentAt: new Date() });
        } catch (err) {
          console.error('[scheduler] unclaimedSLA error:', err.message);
        }
      }
    } catch (err) {
      console.error('[scheduler] unclaimedSLA guild error:', err.message);
    }
  }
}

module.exports = { unclaimedSLAJob };
