const { Schema, model } = require('mongoose');

const TicketTypeSchema = new Schema({
  guildId: { type: String, required: true },
  name: { type: String, required: true },
  emoji: { type: String, default: '🎫' },
  description: { type: String, default: 'Open a ticket.' },
  questions: { type: [String], default: [] },
  staffRoles: { type: [String], default: [] },
});

module.exports = model('TicketType', TicketTypeSchema);
