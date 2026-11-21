'use strict';

const Ticket = require('../models/Ticket');

function formatTicketNumber(n) {
  return String(n || 0).padStart(4, '0');
}

function sanitize(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 20) || 'staff';
}

function buildTicketChannelName(ticket, typeKey) {
  const num = formatTicketNumber(ticket.ticketNumber);
  const customName = ticket.customName || null;
  const baseName = customName || typeKey || 'ticket';

  let name;
  if (ticket.claimedBy && ticket.claimedByName) {
    name = `${sanitize(ticket.claimedByName)}-${num}`;
  } else {
    name = `${sanitize(baseName)}-${num}`;
  }

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

module.exports = { formatTicketNumber, buildTicketChannelName, syncTicketChannel, sanitize };
