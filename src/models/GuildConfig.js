const { Schema, model } = require('mongoose');

const GuildConfigSchema = new Schema({
  guildId: { type: String, required: true, unique: true },
  announcementChannel:  { type: String, default: null },
  reviewChannel:        { type: String, default: null },
  logChannel:           { type: String, default: null },
  partnerListChannel:   { type: String, default: null },
  ticketCategory:       { type: String, default: null },
  prStaffRoles:         { type: [String], default: [] },
  partnerRepRoles:      { type: [String], default: [] },
  partnerListText:      { type: String, default: `## ${require('../theme').EMOJI.partner} Our Partners\n\n` },
  ticketPanelText:      { type: String, default: `## ${require('../theme').EMOJI.ticket} Support & Partnership\n\nSelect an option below to open a ticket.` },
  reviewText:           { type: String, default: 'Please complete your monthly partnership review.' },
  reviewMode:           { type: String, enum: ['dm', 'link'], default: 'link' },
  reviewLink:           { type: String, default: null },
  reviewQuestions:      { type: [String], default: ['How active was your group this month?', 'Any events hosted?', 'Any issues to report?'] },
  partnerListMessageIds: { type: [String], default: [] },
  // legacy — kept to avoid data loss, no longer written
  partnerListMessageId: { type: String, default: null },
  announcementWebhook:  { type: String, default: null },
  reviewWebhook:        { type: String, default: null },
  partnerListWebhook:   { type: String, default: null },
});

module.exports = model('GuildConfig', GuildConfigSchema);
