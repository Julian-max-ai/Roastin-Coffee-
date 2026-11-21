'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-export')
    .setDescription('Export server config as JSON.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!cfg) return interaction.editReply(errorCard('No config found.'));

    const exportData = cfg.toObject();
    delete exportData._id;
    delete exportData.__v;
    const json = JSON.stringify(exportData, null, 2);
    const attachment = new AttachmentBuilder(Buffer.from(json, 'utf-8'), { name: `config-${guildId}.json` });
    await interaction.editReply({ content: 'Config exported.', files: [attachment] });
  },
};
