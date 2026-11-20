const { Schema, model } = require('mongoose');

const ReviewSubmissionSchema = new Schema({
  guildId:     { type: String, required: true },
  partnerId:   { type: String, required: true },
  month:       { type: String, required: true }, // YYYY-MM
  answers:     { type: [String], default: [] },
  submittedBy: { type: String, required: true },
  submittedAt: { type: Date, default: Date.now },
});

ReviewSubmissionSchema.index({ guildId: 1, partnerId: 1, month: 1 }, { unique: true });

module.exports = model('ReviewSubmission', ReviewSubmissionSchema);
