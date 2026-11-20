'use strict';

const COLORS = {
  primary:     0xC68E4E, // caramel
  dark:        0x3E2723, // espresso
  success:     0x4CAF7A,
  warning:     0xE8A33D,
  error:       0xD9534F,
  termination: 0x7A1F1F,
};

const INFRACTION_COLORS = {
  warning:     COLORS.warning,
  strike:      COLORS.error,
  termination: COLORS.termination,
};

const EMOJI = {
  partner:     '🤝',
  ticket:      '🎫',
  review:      '📋',
  event:       '📣',
  warning:     '⚠️',
  strike:      '🔴',
  termination: '🚫',
  success:     '✅',
  error:       '❌',
  config:      '⚙️',
  link:        '🔗',
  discord:     '💬',
  roblox:      '🎮',
  log:         '📝',
  coffee:      '☕',
  user:        '👤',
  calendar:    '📅',
  report:      '📊',
  close:       '🔒',
  claim:       '🙋',
};

const BRAND = {
  name:    "Roastin' Coffee",
  sub:     'PR System',
  logoUrl: process.env.BRAND_LOGO_URL || null,
};

const STRIKE_LIMIT  = 3;
const PAGE_SIZE     = 5;
const TICKET_CLOSE_DELAY_MS = 5000;
const EVENT_REQUEST_COOLDOWN_MS = 30000;

module.exports = { COLORS, INFRACTION_COLORS, EMOJI, BRAND, STRIKE_LIMIT, PAGE_SIZE, TICKET_CLOSE_DELAY_MS, EVENT_REQUEST_COOLDOWN_MS };
