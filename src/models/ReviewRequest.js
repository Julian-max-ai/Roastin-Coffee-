'use strict';
const { Schema, model } = require('mongoose');

const ReviewRequestSchema = new Schema({
  guildId:     { type: String, required: true },
  partnerId:   { type: String, required: true },
  month:       { type: String, required: true }, // YYYY-MM
  channelId:   { type: String, default: null },
  messageId:   { type: String, default: null },
  status:      { type: String, enum: ['pending', 'done', 'skipped'], default: 'pending' },
  createdAt:   { type: Date, default: Date.now },
  remindedAt:  { type: Date, default: null },
  overdueAt:   { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completedBy: { type: String, default: null },
});

ReviewRequestSchema.index({ guildId: 1, partnerId: 1, month: 1 }, { unique: true });

module.exports = model('ReviewRequest', ReviewRequestSchema);
