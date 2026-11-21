'use strict';
const Ticket = require('../models/Ticket');

function sanitize(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 12);
}

function buildTicketChannelName(ticket, typeKey) {
  const baseName = ticket.baseName || `${typeKey}-${sanitize(ticket.userId?.slice(0, 6) || 'user')}`;
  const claimed = ticket.claimedByName ? sanitize(ticket.claimedByName) : (ticket.claimedBy ? sanitize(ticket.claimedBy.slice(0, 8)) : null);
  const priority = ticket.priority || 'normal';

  let prefix = '';
  if (priority === 'high') prefix = '⚠️';
  else if (priority === 'urgent') prefix = '🔥';

  let statusEmoji = '🔴';
  if (ticket.closeRequestedAt) statusEmoji = '🟡';
  else if (ticket.claimedBy) statusEmoji = '🟢';

  let name = `${statusEmoji}┃${baseName}`;
  if (claimed) name += `┃${claimed}`;
  if (prefix) name = `${prefix}${name}`;

  return name.slice(0, 100).toLowerCase();
}

async function syncTicketChannel(channel, ticket, typeKey) {
  if (!channel) return;
  const cfg = await require('../models/GuildConfig').findOne({ guildId: ticket.guildId }).catch(() => null);
  if (cfg?.automation?.ticketRenameOnClaim === false) return;

  const newName = buildTicketChannelName(ticket, typeKey);
  if (channel.name === newName) return;

  try {
    await Promise.race([
      channel.setName(newName),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ]);
  } catch {
    await Ticket.findByIdAndUpdate(ticket._id, { pendingRename: true }).catch(() => {});
  }
}

module.exports = { buildTicketChannelName, syncTicketChannel, sanitize };
