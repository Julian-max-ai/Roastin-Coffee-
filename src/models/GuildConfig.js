const { Schema, model } = require('mongoose');

const GuildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },

  // Channels
  announcementChannel: { type: String, default: null },
  reviewChannel: { type: String, default: null },
  logChannel: { type: String, default: null },
  partnerListChannel: { type: String, default: null },
  ticketCategory: { type: String, default: null },

  // Webhook URLs (for Components V2 / dweeb integration)
  announcementWebhook: { type: String, default: null },
  reviewWebhook: { type: String, default: null },
  partnerListWebhook: { type: String, default: null },

  // Roles (multiple allowed)
  prStaffRoles: { type: [String], default: [] },
  partnerRepRoles: { type: [String], default: [] },

  // Custom texts (support {partners} placeholder)
  partnerListText: { type: String, default: '## 🤝 Our Partners\n\n{partners}' },
  ticketPanelText: { type: String, default: '## 🎫 Support & Partnership\n\nSelect an option below to open a ticket.' },
  reviewText: { type: String, default: '## 📋 Monthly Partnership Review\n\nPlease complete your monthly review.' },

  // Review mode: 'dm' = DM questions, 'link' = external link
  reviewMode: { type: String, enum: ['dm', 'link'], default: 'link' },
  reviewLink: { type: String, default: null },
  reviewQuestions: { type: [String], default: ['How active was your group this month?', 'Any events hosted?', 'Any issues to report?'] },

  // Partner list message ID for editing
  partnerListMessageId: { type: String, default: null },
});

module.exports = model('GuildConfig', GuildConfigSchema);
