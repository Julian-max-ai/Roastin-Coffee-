'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { getText, TEXT_DEFAULTS, getAllKeys } = require('../utils/texts');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config-texts')
    .setDescription('Bot-Texte bearbeiten.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('key').setDescription('Text-Key').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('value').setDescription('Neuer Text').setRequired(true)),
  async autocomplete(interaction) {
    const keys = getAllKeys();
    const focused = interaction.options.getFocused().toLowerCase();
    await interaction.respond(keys.filter(k => k.includes(focused)).slice(0, 25).map(k => ({ name: k, value: k })));
  },
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const key = interaction.options.getString('key');
    const value = interaction.options.getString('value');
    const entry = TEXT_DEFAULTS[key];
    if (!entry) return interaction.editReply(errorCard('Unknown key.'));
    if (value.length > entry.maxLength) return interaction.editReply(errorCard(`Max ${entry.maxLength} characters.`));

    if (!cfg.texts) cfg.texts = {};
    cfg.texts[key] = value;
    await GuildConfig.findOneAndUpdate({ guildId }, { texts: cfg.texts }, { upsert: true });
    await require('../utils/audit').audit(guildId, interaction.user.id, 'config_text_edit', 'config', key, { value: value.slice(0, 100) });
    await interaction.editReply(successCard(`Text **${key}** updated.`));
  },
};
