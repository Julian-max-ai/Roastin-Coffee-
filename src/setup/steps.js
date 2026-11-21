'use strict';
const { PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

function checkStatus(id, cfg, guild) {
  if (!cfg) return false;
  switch (id) {
    case 'welcome': {
      const me = guild?.members?.me;
      if (!me) return false;
      const perms = ['ManageChannels', 'ManageRoles', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ManageMessages'];
      return perms.every(p => me.permissions.has(PermissionFlagsBits[p]));
    }
    case 'roles': return (cfg.adminRoles?.length > 0) && (cfg.prStaffRoles?.length > 0);
    case 'channels': return cfg.logChannel && cfg.reviewChannel && cfg.transcriptChannel;
    case 'tickets': return !!cfg.ticketCategory;
    case 'dweeb': return true;
    case 'partners': return true;
    case 'infractions': return true;
    case 'finish': return true;
    default: return false;
  }
}

const SETUP_STEPS = [
  { id: 'welcome', required: true, title: 'Welcome & Requirements',
    why: 'This bot manages partner reviews, tickets, infractions, and events for your PR team.',
    how: ['Check that the bot has the required permissions below.', 'Fix any issues marked with ❌.', 'Enable Message Content Intent in the Developer Portal if needed.'] },
  { id: 'roles', required: true, title: 'Roles',
    why: 'Admin, PR Staff, and Partner Representative roles control who can do what.',
    how: ['Select existing roles or create new ones.', 'Admin: full access to config/setup.', 'Staff: partners, tickets, infractions.', 'Rep: reviews and events.'] },
  { id: 'channels', required: true, title: 'Channels',
    why: 'Log, transcript, review, announcement, and partner list channels are needed.',
    how: ['Click "Create all for me" to auto-create a "Roastin PR" category with 5 channels.', 'Or select existing channels.', 'Staff-only channels are hidden from @everyone.'] },
  { id: 'tickets', required: true, title: 'Tickets',
    why: 'Ticket system for support, partnerships, and reports.',
    how: ['Create or select a ticket category.', 'Initialize ticket types (general, partnership, report).', 'Toggle auto-close and ratings.'] },
  { id: 'dweeb', required: false, title: 'Ticket Panel (dweeb)',
    why: 'dweeb.faizo.net is an online Discord message designer (not part of this bot).',
    how: ['1. Open dweeb.faizo.net and design your panel.', '2. Add 3 buttons with Custom-IDs: ticket_open:general, ticket_open:partnership, ticket_open:report.', '3. Copy the result.', '4. Run /dweeb send in your panel channel and paste.', '5. Test by clicking a button.', '6. Click "Open test ticket" to verify.'] },
  { id: 'partners', required: false, title: 'Partners & Reviews',
    why: 'Each partner gets their own channel. Reviews are sent monthly.',
    how: ['Set partner category, auto-assign rep roles, review send day, and mode (form/link).', 'Example: /partner add name:Test roblox:<link> discord:<invite> representative:@user'] },
  { id: 'infractions', required: false, title: 'Infractions & Events',
    why: 'Strike system and event request flow.',
    how: ['Set strike limit, expiry days, event channel, and who can request events.'] },
  { id: 'finish', required: true, title: 'Finish',
    why: 'Review your setup and start using the bot.',
    how: ['Check all items are green.', 'Use /config for further adjustments.', 'Run /doctor for a health check.'] },
];

module.exports = { SETUP_STEPS, checkStatus };
