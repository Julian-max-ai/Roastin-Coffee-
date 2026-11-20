'use strict';
const AuditEntry = require('../models/AuditEntry');

/**
 * Write an audit log entry. Never throws — errors are swallowed so callers
 * don't need try/catch around every action.
 */
async function audit(guildId, actorId, action, targetType = null, targetId = null, details = {}) {
  try {
    await AuditEntry.create({ guildId, actorId, action, targetType, targetId, details });
  } catch (err) {
    console.error('[audit]', err.message);
  }
}

module.exports = { audit };
