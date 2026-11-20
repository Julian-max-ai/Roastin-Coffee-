const { Schema, model } = require('mongoose');

const InfractionSchema = new Schema({
  guildId:      { type: String, required: true },
  partnerId:    { type: String, required: true },
  type:         { type: String, enum: ['warning', 'strike', 'termination'], required: true },
  reason:       { type: String, required: true },
  issuedBy:     { type: String, required: true },
  issuedAt:     { type: Date, default: Date.now },
  removed:      { type: Boolean, default: false },
  expired:      { type: Boolean, default: false },
  expiresAt:    { type: Date, default: null },
  appealStatus: { type: String, enum: ['none', 'pending', 'accepted', 'rejected'], default: 'none' },
  appealReason: { type: String, default: null },
});

InfractionSchema.index({ guildId: 1, partnerId: 1 });

module.exports = model('Infraction', InfractionSchema);
