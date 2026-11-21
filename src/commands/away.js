'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('away')
    .setDescription('Staff-Abwesenheit eintragen.')
    .addSubcommand(s => s.setName('set').setDescription('Abwesenheit setzen.')
      .addStringOption(o => o.setName('from').setDescription('Von (YYYY-MM-DD)').setRequired(true))
      .addStringOption(o => o.setName('to').setDescription('Bis (YYYY-MM-DD)').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Grund').setRequired(false)))
    .addSubcommand(s => s.setName('clear').setDescription('Abwesenheit beenden.')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId, user } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    const sub = interaction.options.getSubcommand();

    if (sub === 'set') {
      const from = interaction.options.getString('from');
      const to = interaction.options.getString('to');
      const reason = interaction.options.getString('reason') || '';
      const away = cfg?.awayList || [];
      const filtered = away.filter(a => a.userId !== user.id);
      filtered.push({ userId: user.id, from, to, reason });
      await GuildConfig.findOneAndUpdate({ guildId }, { awayList: filtered }, { upsert: true });
      return interaction.editReply(successCard(`Abwesenheit eingetragen: ${from} bis ${to}.`));
    }

    if (sub === 'clear') {
      const away = (cfg?.awayList || []).filter(a => a.userId !== user.id);
      await GuildConfig.findOneAndUpdate({ guildId }, { awayList: away }, { upsert: true });
      return interaction.editReply(successCard('Abwesenheit beendet.'));
    }
  },
};
