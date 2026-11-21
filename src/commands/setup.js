'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { renderStep, findNextStep } = require('../setup/wizard');
const { SETUP_STEPS, checkStatus } = require('../setup/steps');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Guided bot setup wizard.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('start').setDescription('Start or continue the setup wizard.'))
    .addSubcommand(s => s.setName('status').setDescription('Show setup progress.')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId, guild } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const lines = SETUP_STEPS.map(s => {
        const done = s.id === 'finish' ? true : checkStatus(s.id, cfg, guild);
        return `${done ? '✅' : '⚠️'} **${s.title}**${s.required ? '' : ' (optional)'}`;
      });
      await interaction.editReply({ content: lines.join('\n'), ephemeral: true });
      return;
    }

    // start: open first incomplete required step
    const stepIdx = findNextStep(cfg, guild);
    await renderStep(interaction, SETUP_STEPS[stepIdx].id, false);
  },
};
