'use strict';
const Partner = require('../models/Partner');

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

module.exports = { runMigrations };
