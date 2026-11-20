const { Schema, model } = require('mongoose');

const InfractionSchema = new Schema({
  guildId: { type: String, required: true },
  partnerId: { type: String, required: true }, // Partner _id
  type: { type: String, enum: ['warning', 'strike', 'termination'], required: true },
  reason: { type: String, required: true },
  issuedBy: { type: String, required: true }, // Discord user ID
  issuedAt: { type: Date, default: Date.now },
  removed: { type: Boolean, default: false },
});

module.exports = model('Infraction', InfractionSchema);
