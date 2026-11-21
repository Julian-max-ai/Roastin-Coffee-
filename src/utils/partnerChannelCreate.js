'use strict';
const { PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');

async function createPartnerChannel(guild, partner, cfg) {
  const category = cfg?.partnerCategory ? await guild.channels.fetch(cfg.partnerCategory).catch(() => null) : null;
  const channelName = `🤝┃${partner.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30)}`;
  
  const overwrites = [
    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: guild.members.me.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ReadMessageHistory] },
  ];

  // Add reps
  const reps = partner.representativeIds?.length ? partner.representativeIds : [partner.representativeId];
  for (const repId of reps) {
    overwrites.push({ id: repId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  // Add staff roles
  if (cfg?.prStaffRoles?.length) {
    for (const roleId of cfg.prStaffRoles) {
      overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageMessages] });
    }
  }

  const channel = await guild.channels.create({
    name: channelName,
    type: 0, // Text
    parent: category?.id || null,
    permissionOverwrites: overwrites,
  }).catch(() => null);

  if (channel) {
    await Partner.findByIdAndUpdate(partner._id, { channelId: channel.id, channelMissing: false }).catch(() => {});
  }
  return channel;
}

module.exports = { createPartnerChannel };
