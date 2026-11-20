const { Schema, model } = require('mongoose');

const PartnerSchema = new Schema({
  guildId:          { type: String, required: true },
  name:             { type: String, required: true },
  robloxLink:       { type: String, default: null },
  discordInvite:    { type: String, default: null },
  representativeId: { type: String, default: null },
  addedAt:          { type: Date, default: Date.now },
  status:           { type: String, enum: ['active', 'probation', 'inactive'], default: 'active' },
  inviteValid:      { type: Boolean, default: true },
  lastInviteCheck:  { type: Date, default: null },
  anniversaryNotifiedYear: { type: Number, default: null },
});

module.exports = model('Partner', PartnerSchema);
