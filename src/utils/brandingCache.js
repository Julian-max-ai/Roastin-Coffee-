'use strict';
const cache = new Map();

function set(guildId, branding) { cache.set(guildId, branding); }
function get(guildId) { return cache.get(guildId) || null; }
function clear(guildId) { cache.delete(guildId); }

module.exports = { set, get, clear };
