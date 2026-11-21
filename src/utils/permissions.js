'use strict';
const { PermissionFlagsBits } = require('discord.js');

const LEVEL = { PUBLIC: 0, PARTNER_REP: 1, STAFF: 2, ADMIN: 3 };

function getLevel(member, cfg) {
  if (!member) return LEVEL.PUBLIC;
  // Owner or Administrator
  if (member.guild?.ownerId === member.id) return LEVEL.ADMIN;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return LEVEL.ADMIN;
  // adminRoles
  if (cfg?.adminRoles?.length && cfg.adminRoles.some(r => member.roles.cache.has(r))) return LEVEL.ADMIN;
  // Bootstrap: if adminRoles is empty, only Administrator/Owner counts (already handled above)
  // prStaffRoles
  if (cfg?.prStaffRoles?.length && cfg.prStaffRoles.some(r => member.roles.cache.has(r))) return LEVEL.STAFF;
  // partnerRepRoles
  if (cfg?.partnerRepRoles?.length && cfg.partnerRepRoles.some(r => member.roles.cache.has(r))) return LEVEL.PARTNER_REP;
  return LEVEL.PUBLIC;
}

function hasLevel(member, cfg, minLevel) {
  const min = typeof minLevel === 'string' ? LEVEL[minLevel] : minLevel;
  return getLevel(member, cfg) >= min;
}

async function requireLevel(interaction, minLevel, client) {
  const cfg = await (require('../models/GuildConfig')).findOne({ guildId: interaction.guildId }).catch(() => null);
  const member = interaction.member;
  if (hasLevel(member, cfg, minLevel)) return true;
  const labels = { ADMIN: 'Admin', STAFF: 'PR Staff', PARTNER_REP: 'Partner Representative' };
  const needed = typeof minLevel === 'string' ? minLevel : Object.keys(LEVEL).find(k => LEVEL[k] === minLevel);
  await interaction.reply({ content: `You need the role **${labels[needed] || needed}**.`, ephemeral: true }).catch(() => {});
  return false;
}

function isStaff(member, cfg) {
  return hasLevel(member, cfg, 'STAFF');
}

function isAdmin(member, cfg) {
  return hasLevel(member, cfg, 'ADMIN');
}

module.exports = { LEVEL, getLevel, hasLevel, requireLevel, isStaff, isAdmin };
