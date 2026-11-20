'use strict';

const COLORS = {
  primary:     0xC68E4E, // caramel
  dark:        0x3E2723, // espresso
  success:     0x4CAF7A,
  warning:     0xE8A33D,
  error:       0xD9534F,
  termination: 0x7A1F1F,
  // ticket priority colors
  low:         0x78909C,
  normal:      0xC68E4E,
  high:        0xE8A33D,
  urgent:      0xD9534F,
};

const INFRACTION_COLORS = {
  warning:     COLORS.warning,
  strike:      COLORS.error,
  termination: COLORS.termination,
};

const PRIORITY_EMOJI = { low: '🔵', normal: '⚪', high: '🟡', urgent: '🔴' };
const PRIORITY_COLOR = { low: COLORS.low, normal: COLORS.normal, high: COLORS.high, urgent: COLORS.urgent };

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
  release:     '🔓',
  appeal:      '📨',
  stats:       '📈',
  doctor:      '🩺',
  export:      '📤',
  audit:       '🔍',
  star:        '⭐',
  anniversary: '🎂',
  inactive:    '💤',
  probation:   '⚠️',
  active:      '✅',
  interested:  '🙌',
  reminder:    '🔔',
  overdue:     '⏰',
};

const BRAND = {
  name:    "Roastin' Coffee",
  sub:     'PR System',
  logoUrl: process.env.BRAND_LOGO_URL || null,
};

const STRIKE_LIMIT  = 3;
const PAGE_SIZE     = 5;
const TICKET_CLOSE_DELAY_MS     = 5000;
const EVENT_REQUEST_COOLDOWN_MS = 30000;

module.exports = {
  COLORS, INFRACTION_COLORS, PRIORITY_EMOJI, PRIORITY_COLOR,
  EMOJI, BRAND,
  STRIKE_LIMIT, PAGE_SIZE, TICKET_CLOSE_DELAY_MS, EVENT_REQUEST_COOLDOWN_MS,
};
