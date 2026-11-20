const { Schema, model } = require('mongoose');

const GuildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  announcementChannel: { type: String, default: null },
  reviewChannel: { type: String, default: null },
  logChannel: { type: String, default: null },
  ticketCategory: { type: String, default: null },
  prStaffRole: { type: String, default: null },
  partnerRepRole: { type: String, default: null },
});

module.exports = model('GuildConfig', GuildConfigSchema);
