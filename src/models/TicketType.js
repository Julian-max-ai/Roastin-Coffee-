const { Schema, model } = require('mongoose');

const TicketTypeSchema = new Schema({
  guildId: { type: String, required: true },
  customId: { type: String, required: true }, // e.g. "general", "partnership", "report"
  name: { type: String, required: true },
  emoji: { type: String, default: '🎫' },
  questions: { type: [String], default: [] },
  staffRoles: { type: [String], default: [] },
  welcomeText: { type: String, default: 'A staff member will be with you shortly.' },
});

module.exports = model('TicketType', TicketTypeSchema);
