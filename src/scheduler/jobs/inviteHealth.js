'use strict';
const Partner = require('../../models/Partner');
const GuildConfig = require('../../models/GuildConfig');
const { card, logCard } = require('../../ui');
const { EMOJI, COLORS } = require('../../theme');
const { audit } = require('../../utils/audit');

const SLEEP = 500;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function inviteHealthJob(client, setLastRun) {
  const configs = await GuildConfig.find({ 'automation.inviteHealthCheck': true }).catch(() => []);
  const now = new Date();

  for (const cfg of configs) {
    try {
      setLastRun('inviteHealth', cfg.guildId);
      const partners = await Partner.find({ guildId: cfg.guildId, discordInvite: { $ne: null } }).catch(() => []);

      const logChannel = cfg.logChannel ? await client.channels.fetch(cfg.logChannel).catch(() => null) : null;

      const invalid = [];
      for (const partner of partners) {
        try {
          const lastCheck = partner.lastInviteCheck;
          const daysSinceCheck = lastCheck ? (now - new Date(lastCheck)) / (1000 * 60 * 60 * 24) : 999;
          if (daysSinceCheck < 7) continue; // Check weekly

          try {
            await client.fetchInvite(partner.discordInvite).catch(() => {
              invalid.push(partner);
            });
          } catch {
            invalid.push(partner);
          }

          await Partner.findByIdAndUpdate(partner._id, { lastInviteCheck: now });
        } catch (err) {
          console.error('[scheduler] inviteHealth partner error:', err.message);
        }
        await sleep(SLEEP);
      }

      if (invalid.length > 0 && logChannel) {
        await logChannel.send(card({
          title: `${EMOJI.warning} Invite Health Check`,
          description: `The following Discord invites appear invalid:\n${invalid.map(p => `• **${p.name}** (<@${p.representativeId}>)`).join('\n')}`,
          color: COLORS.warning,
          buttons: [],
          ephemeral: false,
        })).catch(() => {});
      }
    } catch (err) {
      console.error('[scheduler] inviteHealth guild error:', err.message);
    }
  }
}

module.exports = { inviteHealthJob };
