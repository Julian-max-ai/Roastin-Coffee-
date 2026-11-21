const { Schema, model } = require('mongoose');

const TicketSchema = new Schema({
  guildId:           { type: String, required: true },
  channelId:         { type: String, required: true },
  userId:            { type: String, required: true },
  typeId:            { type: String, required: true },
  claimedBy:         { type: String, default: null },
  status:            { type: String, enum: ['open', 'closing', 'closed'], default: 'open' },
  priority:          { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
  openedAt:          { type: Date, default: Date.now },
  firstStaffReplyAt: { type: Date, default: null },
  closedAt:          { type: Date, default: null },
  closedBy:          { type: String, default: null },
  closedReason:      { type: String, default: null },
  lastActivityAt:    { type: Date, default: Date.now },
  rating:            { type: Number, default: null },
  ratingFeedback:    { type: String, default: null },
  reminderSentAt:    { type: Date, default: null },
  autoCloseSentAt:   { type: Date, default: null },
  ratingSentAt:      { type: Date, default: null },
  welcomeMessageId:  { type: String, default: null },
  closeRequestedAt:  { type: Date, default: null },
  closeRequestedBy:  { type: String, default: null },
  closeRequestReason:{ type: String, default: null },
  closeSource:       { type: String, default: null },
  deleteAt:          { type: Date, default: null },
  ticketNumber:      { type: Number, default: null },
  baseName:          { type: String, default: null },
  pendingRename:     { type: Boolean, default: false },
  closeRequestMessageId: { type: String, default: null },
  channelDeletedAt:     { type: Date, default: null },
});

TicketSchema.index({ guildId: 1, channelId: 1 });
TicketSchema.index({ guildId: 1, userId: 1, status: 1 });

module.exports = model('Ticket', TicketSchema);
