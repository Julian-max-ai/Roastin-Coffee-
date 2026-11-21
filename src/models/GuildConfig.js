const { Schema, model } = require('mongoose');

const GuildConfigSchema = new Schema({
  guildId:              { type: String, required: true, unique: true },
  announcementChannel:  { type: String, default: null },
  reviewChannel:        { type: String, default: null },
  logChannel:           { type: String, default: null },
  partnerListChannel:   { type: String, default: null },
  ticketCategory:       { type: String, default: null },
  ticketCounter:        { type: Number, default: 0 },
  prStaffRoles:         { type: [String], default: [] },
  adminRoles:           { type: [String], default: [] },
  partnerRepRoles:      { type: [String], default: [] },
  ticketBlacklist:      { type: [{ userId: String, reason: String, addedBy: String, addedAt: Date }], default: [] },
  partnerListText:      { type: String, default: `## 🤝 Our Partners\n\n` },
  ticketPanelText:      { type: String, default: `## 🎫 Support & Partnership\n\nSelect an option below to open a ticket.` },
  reviewText:           { type: String, default: 'Please complete your monthly partnership review.' },
  reviewMode:           { type: String, enum: ['dm', 'link'], default: 'link' },
  reviewLink:           { type: String, default: null },
  reviewQuestions:      { type: [String], default: ['How active was your group this month?', 'Any events hosted?', 'Any issues to report?'] },
  texts:                { type: Schema.Types.Mixed, default: {} },
  macros:               { type: [{ name: String, text: String }], default: [] },
  awayList:             { type: [{ userId: String, from: String, to: String, reason: String }], default: [] },
  partnerListMessageIds:{ type: [String], default: [] },
  // legacy — kept to avoid data loss
  partnerListMessageId: { type: String, default: null },
  announcementWebhook:  { type: String, default: null },
  reviewWebhook:        { type: String, default: null },
  partnerListWebhook:   { type: String, default: null },
  // ── Automation ──────────────────────────────────────────────────────────────
  automation: {
    ticketInactivityEnabled:  { type: Boolean, default: true },
    ticketInactivityHours:    { type: Number, default: 24 },
    ticketAutoCloseEnabled:   { type: Boolean, default: true },
    ticketAutoCloseHours:     { type: Number, default: 48 },
    ticketCloseRequestHours:  { type: Number, default: 24 },
    maxOpenTicketsPerUser:    { type: Number, default: 3 },
    ticketRatingEnabled:      { type: Boolean, default: true },
    infractionExpiryWarning:  { type: Number, default: 90 },  // days, 0=never
    infractionExpiryStrike:   { type: Number, default: 180 }, // days, 0=never
    reviewReminderDays:       { type: Number, default: 7 },
    reviewOverdueDays:        { type: Number, default: 14 },
    eventReminderHours:       { type: Number, default: 1 },
    anniversaryAnnouncements: { type: Boolean, default: true },
    inviteHealthCheck:        { type: Boolean, default: true },
    autoAssignRepRoles:       { type: Boolean, default: true },
    weeklyEventDigest:        { type: Boolean, default: false },
    unclaimedAlertMinutes:    { type: Number, default: 30 },
    unclaimedAlertRole:       { type: String, default: null },
  },
});

module.exports = model('GuildConfig', GuildConfigSchema);
