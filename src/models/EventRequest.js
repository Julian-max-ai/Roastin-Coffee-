const { Schema, model } = require('mongoose');

const EventRequestSchema = new Schema({
  guildId:      { type: String, required: true },
  submitterId:  { type: String, required: true },
  title:        { type: String, required: true },
  description:  { type: String, required: true },
  date:         { type: String, required: true },
  type:         { type: String, enum: ['Event', 'Shift'], required: true },
  status:       { type: String, enum: ['pending', 'approved', 'denied'], default: 'pending' },
  logMessageId: { type: String, default: null },
  decidedBy:    { type: String, default: null },
  decidedAt:    { type: Date, default: null },
  denyReason:   { type: String, default: null },
  createdAt:    { type: Date, default: Date.now },
});

module.exports = model('EventRequest', EventRequestSchema);
