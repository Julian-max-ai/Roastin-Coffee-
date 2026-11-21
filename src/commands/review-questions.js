'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review-questions')
    .setDescription('Review-Fragen verwalten.')
    .addSubcommand(s => s.setName('list').setDescription('Fragen anzeigen.'))
    .addSubcommand(s => s.setName('add').setDescription('Frage hinzufügen.')
      .addStringOption(o => o.setName('question').setDescription('Frage').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Frage entfernen.')
      .addIntegerOption(o => o.setName('index').setDescription('Index (1-based)').setRequired(true)))
    .addSubcommand(s => s.setName('reset').setDescription('Auf Standard zurücksetzen.')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const sub = interaction.options.getSubcommand();
    const questions = cfg?.reviewQuestions || [];

    if (sub === 'list') {
      if (!questions.length) return interaction.editReply(errorCard('No questions configured.'));
      const desc = questions.map((q, i) => `${i + 1}. ${q}`).join('\n');
      return interaction.editReply(successCard(desc));
    }

    if (sub === 'add') {
      const q = interaction.options.getString('question');
      if (q.length > 45) return interaction.editReply(errorCard('Max 45 characters per question.'));
      if (questions.length >= 10) return interaction.editReply(errorCard('Max 10 questions.'));
      questions.push(q);
      await GuildConfig.findOneAndUpdate({ guildId }, { reviewQuestions: questions }, { upsert: true });
      await require('../utils/audit').audit(guildId, interaction.user.id, 'review_question_add', 'config', 'reviewQuestions');
      return interaction.editReply(successCard(`Question added. Total: ${questions.length}`));
    }

    if (sub === 'remove') {
      const idx = interaction.options.getInteger('index') - 1;
      if (idx < 0 || idx >= questions.length) return interaction.editReply(errorCard('Invalid index.'));
      questions.splice(idx, 1);
      await GuildConfig.findOneAndUpdate({ guildId }, { reviewQuestions: questions }, { upsert: true });
      await require('../utils/audit').audit(guildId, interaction.user.id, 'review_question_remove', 'config', 'reviewQuestions');
      return interaction.editReply(successCard(`Question removed. Total: ${questions.length}`));
    }

    if (sub === 'reset') {
      const defaults = ['How active was your group this month?', 'Any events hosted?', 'Any issues to report?'];
      await GuildConfig.findOneAndUpdate({ guildId }, { reviewQuestions: defaults }, { upsert: true });
      await require('../utils/audit').audit(guildId, interaction.user.id, 'review_question_reset', 'config', 'reviewQuestions');
      return interaction.editReply(successCard('Questions reset to defaults.'));
    }
  },
};
