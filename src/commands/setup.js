'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard, infoCard } = require('../ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Guided bot setup.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('start').setDescription('Start or continue the setup wizard.'))
    .addSubcommand(s => s.setName('status').setDescription('Show setup progress.'))
    .addSubcommand(s => s.setName('help').setDescription('Explanations for a topic.')
      .addStringOption(o => o.setName('topic').setDescription('Topic').setRequired(true)
        .addChoices(
          { name: 'Rights', value: 'rights' },
          { name: 'Channels', value: 'channels' },
          { name: 'Tickets', value: 'tickets' },
          { name: 'Partner', value: 'partners' },
          { name: 'Reviews', value: 'reviews' },
          { name: 'Infractions', value: 'infractions' },
          { name: 'Events', value: 'events' },
          { name: 'Automation', value: 'automation' },
          { name: 'Dweeb', value: 'dweeb' },
        ))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });

    if (sub === 'start' || sub === 'status') {
      const progress = cfg?.setupProgress || {};
      const steps = ['rights', 'channels', 'tickets', 'partners', 'reviews', 'infractions', 'events', 'automation'];
      let desc = '**Setup-Fortschritt:**\n\n';
      for (const step of steps) {
        const done = progress[step] === true;
        desc += `${done ? '✅' : '⬜'} ${step}\n`;
      }
      desc += '\nUse `/setup help topic:<name>` for detailed explanations.\nMark steps complete via /config.';
      await interaction.editReply(infoCard('Setup', desc, true));
    }


  },
};
