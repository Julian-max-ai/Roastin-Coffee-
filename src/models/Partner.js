const { Schema, model } = require('mongoose');

const PartnerSchema = new Schema({
  guildId:            { type: String, required: true },
  name:               { type: String, required: true },
  robloxLink:         { type: String, default: null },
  discordInvite:      { type: String, default: null },
  representativeId:   { type: String, default: null },
  representativeIds:  { type: [String], default: [] },
  channelId:          { type: String, default: null },
  channelMissing:     { type: Boolean, default: false },
  notes:              { type: [{ text: String, authorId: String, createdAt: { type: Date, default: Date.now } }], default: [] },
  addedAt:            { type: Date, default: Date.now },
  status:             { type: String, enum: ['active', 'probation', 'inactive', 'removed'], default: 'active' },
  inviteValid:        { type: Boolean, default: true },
  lastInviteCheck:    { type: Date, default: null },
  anniversaryNotifiedYear: { type: Number, default: null },
  exchanges:              { type: [{ type: String, link: String, date: Date, by: String }], default: [] },
  escalationPostedAt:     { type: Date, default: null },
});

PartnerSchema.index({ guildId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

module.exports = model('Partner', PartnerSchema);
