'use strict';
const Partner = require('../models/Partner');
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');

async function runMigrations() {
  // Migrate representativeId -> representativeIds
  const partners = await Partner.find({ $or: [{ representativeIds: { $exists: false } }, { representativeIds: { $size: 0 } }] }).catch(() => []);
  for (const p of partners) {
    if (p.representativeId && (!p.representativeIds || p.representativeIds.length === 0)) {
      p.representativeIds = [p.representativeId];
      await p.save().catch(() => {});
    }
  }
  console.log(`[migration] Migrated ${partners.length} partners.`);
}

// Migrate ticket numbers for existing tickets
async function migrateTicketNumbers() {
  const guilds = await Ticket.distinct('guildId').catch(() => []);
  for (const guildId of guilds) {
    const tickets = await Ticket.find({ guildId, ticketNumber: { $exists: false } }).sort({ createdAt: 1 }).catch(() => []);
    if (!tickets.length) continue;
    let num = 0;
    const lastTicket = await Ticket.findOne({ guildId, ticketNumber: { $exists: true } }).sort({ ticketNumber: -1 }).catch(() => null);
    if (lastTicket) num = lastTicket.ticketNumber || 0;
    for (const t of tickets) {
      num++;
      t.ticketNumber = num;
      await t.save().catch(() => {});
    }
    if (num > 0) {
      await GuildConfig.findOneAndUpdate({ guildId }, { ticketCounter: num }, { upsert: true }).catch(() => {});
    }
  }
  if (guilds.length) console.log('[migration] Migrated ticket numbers.');
}

const origRunMigrations = runMigrations;
async function runAllMigrations() {
  await origRunMigrations();
  await migrateTicketNumbers();
}

module.exports = { runMigrations: runAllMigrations };
