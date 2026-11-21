'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const Infraction = require('../models/Infraction');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats-partners')
    .setDescription('Partner statistics.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await require('../models/GuildConfig').findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const total = await Partner.countDocuments({ guildId });
    const active = await Partner.countDocuments({ guildId, status: 'active' });
    const probation = await Partner.countDocuments({ guildId, status: 'probation' });
    const inactive = await Partner.countDocuments({ guildId, status: 'inactive' });
    const removed = await Partner.countDocuments({ guildId, status: 'removed' });
    const infractions = await Infraction.countDocuments({ guildId, removed: false, expired: false });

    const desc = `**Partner Stats**\n\n` +
      `🤝 Total: ${total}\n` +
      `✅ Active: ${active}\n` +
      `⚠️ Probation: ${probation}\n` +
      `❌ Inactive: ${inactive}\n` +
      `🗑️ Removed: ${removed}\n` +
      `⚡ Active Infractions: ${infractions}`;

    await interaction.editReply(successCard(desc));
  },
};
