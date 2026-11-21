'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-branding')
    .setDescription('Branding anpassen (Name, Sub, Logo, Farbe).')
    .addStringOption(o => o.setName('name').setDescription('Bot-Name'))
    .addStringOption(o => o.setName('sub').setDescription('Untertitel'))
    .addStringOption(o => o.setName('logo').setDescription('Logo-URL'))
    .addStringOption(o => o.setName('color').setDescription('Farbe (Hex)')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const branding = cfg?.branding || {};
    if (interaction.options.getString('name')) branding.name = interaction.options.getString('name');
    if (interaction.options.getString('sub')) branding.sub = interaction.options.getString('sub');
    if (interaction.options.getString('logo')) branding.logoUrl = interaction.options.getString('logo');
    if (interaction.options.getString('color')) branding.color = interaction.options.getString('color');

    await GuildConfig.findOneAndUpdate({ guildId }, { branding }, { upsert: true });
    await require('../utils/audit').audit(guildId, interaction.user.id, 'config_branding', 'config', 'branding');
    await interaction.editReply(successCard('Branding updated.'));
  },
};
