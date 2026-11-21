'use strict';
const mongoose = require('mongoose');

const AdSchema = new mongoose.Schema({
  guildId:     { type: String, required: true, index: true },
  partnerId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Partner', required: true },
  title:       { type: String, required: true },
  link:        { type: String, required: true },
  image:       { type: String, default: null },
  postedAt:    { type: Date, default: Date.now },
  messageId:   { type: String, default: null },
  channelId:   { type: String, default: null },
  clicks:      { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Ad', AdSchema);
