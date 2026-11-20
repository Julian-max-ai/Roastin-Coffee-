'use strict';
const { PermissionFlagsBits } = require('discord.js');

/**
 * Returns true if the member has ManageGuild or any configured PR staff role.
 */
function isStaff(member, cfg) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  if (!cfg?.prStaffRoles?.length) return false;
  return cfg.prStaffRoles.some(r => member.roles.cache.has(r));
}

module.exports = { isStaff };
