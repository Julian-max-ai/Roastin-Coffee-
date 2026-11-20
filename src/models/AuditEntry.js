const { Schema, model } = require('mongoose');

const AuditEntrySchema = new Schema({
  guildId:    { type: String, required: true },
  actorId:    { type: String, required: true },
  action:     { type: String, required: true },
  targetType: { type: String, default: null }, // 'partner'|'infraction'|'ticket'|'event'|'config'
  targetId:   { type: String, default: null },
  details:    { type: Schema.Types.Mixed, default: {} },
  createdAt:  { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 }, // TTL 180 days
});

AuditEntrySchema.index({ guildId: 1, createdAt: -1 });

module.exports = model('AuditEntry', AuditEntrySchema);
