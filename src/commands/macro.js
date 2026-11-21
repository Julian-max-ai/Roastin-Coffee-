'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('macro')
    .setDescription('Textbausteine senden.')
    .addSubcommand(s => s.setName('send').setDescription('Sendet einen Makro.')
      .addStringOption(o => o.setName('name').setDescription('Makro-Name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('add').setDescription('Erstellt einen Makro.')
      .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true))
      .addStringOption(o => o.setName('text').setDescription('Text').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Entfernt einen Makro.')
      .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(s => s.setName('list').setDescription('Listet alle Makros.')),
  async autocomplete(interaction) {
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
    const macros = cfg?.macros || [];
    const focused = interaction.options.getFocused().toLowerCase();
    await interaction.respond(
      macros.filter(m => m.name.toLowerCase().includes(focused)).slice(0, 25).map(m => ({ name: m.name, value: m.name }))
    );
  },
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const macros = cfg?.macros || [];
      if (!macros.length) return interaction.editReply(errorCard('Keine Makros vorhanden.'));
      const desc = macros.map(m => `**${m.name}**: ${m.text.slice(0, 100)}`).join('\n');
      return interaction.editReply(successCard(desc));
    }

    if (sub === 'add') {
      if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Nur Staff.'));
      const name = interaction.options.getString('name');
      const text = interaction.options.getString('text');
      const macros = cfg?.macros || [];
      if (macros.find(m => m.name === name)) return interaction.editReply(errorCard('Makro existiert bereits.'));
      macros.push({ name, text });
      await GuildConfig.findOneAndUpdate({ guildId }, { macros }, { upsert: true });
      return interaction.editReply(successCard(`Makro **${name}** erstellt.`));
    }

    if (sub === 'remove') {
      if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Nur Staff.'));
      const name = interaction.options.getString('name');
      const macros = (cfg?.macros || []).filter(m => m.name !== name);
      await GuildConfig.findOneAndUpdate({ guildId }, { macros }, { upsert: true });
      return interaction.editReply(successCard(`Makro **${name}** entfernt.`));
    }

    if (sub === 'send') {
      const name = interaction.options.getString('name');
      const macro = (cfg?.macros || []).find(m => m.name === name);
      if (!macro) return interaction.editReply(errorCard('Makro nicht gefunden.'));
      await interaction.channel.send(macro.text).catch(() => {});
      return interaction.editReply(successCard(`Makro **${name}** gesendet.`));
    }
  },
};
