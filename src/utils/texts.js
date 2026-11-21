'use strict';

const TEXT_DEFAULTS = {
  ticket_welcome_general: { category: 'tickets', label: 'Ticket Welcome (General)', default: 'Welcome! Please describe your issue.', placeholders: ['{user}', '{staff}', '{ticket}', '{type}'], maxLength: 2000 },
  ticket_claim: { category: 'tickets', label: 'Ticket Claimed', default: '🙋 {staff} has claimed this ticket and will assist you shortly.', placeholders: ['{user}', '{staff}', '{ticket}'], maxLength: 500 },
  ticket_close_request: { category: 'tickets', label: 'Close Request', default: 'A staff member has requested to close this ticket.', placeholders: ['{user}', '{staff}', '{ticket}', '{reason}'], maxLength: 500 },
  ticket_closing: { category: 'tickets', label: 'Ticket Closing', default: 'Ticket is being closed.', placeholders: ['{user}', '{staff}', '{ticket}'], maxLength: 500 },
  ticket_closed_notice: { category: 'tickets', label: 'Ticket Closed Notice', default: 'Your ticket has been closed.', placeholders: ['{user}', '{ticket}'], maxLength: 500 },
  ticket_transcript_dm: { category: 'tickets', label: 'Transcript DM', default: 'Your ticket has been closed. Here is your transcript.', placeholders: ['{user}', '{ticket}'], maxLength: 500 },
  ticket_rating_prompt: { category: 'tickets', label: 'Rating Prompt', default: 'How would you rate your experience?', placeholders: ['{user}', '{ticket}'], maxLength: 500 },
  ticket_inactivity_reminder: { category: 'tickets', label: 'Inactivity Reminder', default: 'This ticket has been inactive. It will be auto-closed soon.', placeholders: ['{user}', '{ticket}', '{hours}'], maxLength: 500 },
  ticket_auto_close_notice: { category: 'tickets', label: 'Auto-Close Notice', default: 'This ticket was automatically closed due to inactivity.', placeholders: ['{user}', '{ticket}'], maxLength: 500 },
  partner_welcome: { category: 'partners', label: 'Partner Welcome', default: 'Welcome to our partnership program!', placeholders: ['{partner}', '{rep}', '{reps}'], maxLength: 2000 },
  partner_list_header: { category: 'partners', label: 'Partner List Header', default: '## 🤝 Our Partners\n\n', placeholders: ['{partners}'], maxLength: 500 },
  review_intro: { category: 'reviews', label: 'Review Intro', default: 'Please complete your monthly partnership review.', placeholders: ['{partner}', '{rep}', '{month}'], maxLength: 1000 },
  review_reminder: { category: 'reviews', label: 'Review Reminder', default: 'Please complete your monthly review for {month}.', placeholders: ['{partner}', '{rep}', '{month}'], maxLength: 500 },
  review_overdue: { category: 'reviews', label: 'Review Overdue', default: '{partner} has not submitted their review for {month}.', placeholders: ['{partner}', '{rep}', '{month}'], maxLength: 500 },
  infraction_warning: { category: 'infractions', label: 'Infraction Warning', default: 'A warning has been issued.', placeholders: ['{partner}', '{rep}', '{reason}'], maxLength: 500 },
  infraction_strike: { category: 'infractions', label: 'Infraction Strike', default: 'A strike has been issued.', placeholders: ['{partner}', '{rep}', '{reason}'], maxLength: 500 },
  appeal_received: { category: 'infractions', label: 'Appeal Received', default: 'An appeal has been submitted.', placeholders: ['{partner}', '{rep}'], maxLength: 500 },
  appeal_accepted: { category: 'infractions', label: 'Appeal Accepted', default: 'Your appeal has been accepted.', placeholders: ['{partner}', '{rep}'], maxLength: 500 },
  appeal_rejected: { category: 'infractions', label: 'Appeal Rejected', default: 'Your appeal has been rejected.', placeholders: ['{partner}', '{rep}', '{reason}'], maxLength: 500 },
  event_approved: { category: 'events', label: 'Event Approved', default: 'Your event has been approved.', placeholders: ['{user}', '{title}'], maxLength: 500 },
  event_denied: { category: 'events', label: 'Event Denied', default: 'Your event has been denied.', placeholders: ['{user}', '{title}', '{reason}'], maxLength: 500 },
  event_reminder: { category: 'events', label: 'Event Reminder', default: 'Event reminder.', placeholders: ['{title}', '{date}'], maxLength: 500 },
  anniversary: { category: 'partners', label: 'Anniversary', default: 'Happy anniversary!', placeholders: ['{partner}', '{rep}'], maxLength: 500 },
  invite_broken: { category: 'partners', label: 'Broken Invite', default: 'Discord invite appears invalid.', placeholders: ['{partner}', '{rep}'], maxLength: 500 },
  weekly_digest_header: { category: 'events', label: 'Weekly Digest Header', default: 'Upcoming events this week:', placeholders: [], maxLength: 500 },
};

function getText(cfg, key, vars = {}) {
  const entry = TEXT_DEFAULTS[key];
  if (!entry) return key;
  let text = cfg?.texts?.[key] || entry.default;
  for (const [k, v] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v ?? ''));
  }
  return text;
}

function getAllKeys() {
  return Object.keys(TEXT_DEFAULTS);
}

function getKeysByCategory(category) {
  return Object.entries(TEXT_DEFAULTS)
    .filter(([, v]) => v.category === category)
    .map(([k]) => k);
}

module.exports = { TEXT_DEFAULTS, getText, getAllKeys, getKeysByCategory };
