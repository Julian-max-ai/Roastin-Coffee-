'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-import')
    .setDescription('Import server config from JSON.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addAttachmentOption(o => o.setName('file').setDescription('Config JSON file').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const attachment = interaction.options.getAttachment('file');
    if (!attachment || !attachment.name.endsWith('.json')) return interaction.editReply(errorCard('Please provide a JSON file.'));

    try {
      const res = await fetch(attachment.url);
      const json = await res.json();
      delete json._id;
      delete json.__v;
      delete json.guildId;
      await GuildConfig.findOneAndUpdate({ guildId }, json, { upsert: true });
      await require('../utils/audit').audit(guildId, interaction.user.id, 'config_import', 'config', 'import');
      await interaction.editReply(successCard('Config imported successfully.'));
    } catch (err) {
      await interaction.editReply(errorCard('Failed to import config: ' + err.message));
    }
  },
};
