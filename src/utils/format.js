'use strict';

/** Discord timestamp: style = D (date), R (relative), F (full), etc. */
function ts(date, style = 'D') {
  const unix = Math.floor((date instanceof Date ? date : new Date(date)).getTime() / 1000);
  return `<t:${unix}:${style}>`;
}

/** Capitalize first letter */
function cap(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Truncate string to n chars with ellipsis */
function truncate(str, n = 100) {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

/** Basic URL validation */
function isUrl(str) {
  try { new URL(str); return true; } catch { return false; }
}

/** Validate Roblox group/community link */
function isRobloxLink(str) {
  return isUrl(str) && /roblox\.com\/(groups|communities)/.test(str);
}

/** Validate Discord invite */
function isDiscordInvite(str) {
  return isUrl(str) && /(discord\.gg\/|discord\.com\/invite\/)/.test(str);
}

/** Strike progress bar: ▰▰▱ 2/3 */
function strikeBar(current, max) {
  const filled = Math.min(current, max);
  return '▰'.repeat(filled) + '▱'.repeat(Math.max(0, max - filled)) + ` ${current}/${max}`;
}

module.exports = { ts, cap, truncate, isUrl, isRobloxLink, isDiscordInvite, strikeBar };
