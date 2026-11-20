const { Schema, model } = require('mongoose');

const PartnerSchema = new Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  robloxLink: { type: String, default: null },
  discordInvite: { type: String, default: null },
  representativeId: { type: String, default: null },
  addedAt: { type: Date, default: Date.now },
});

module.exports = model('Partner', PartnerSchema);
