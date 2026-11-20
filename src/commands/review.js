'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const Partner     = require('../models/Partner');
const { reviewCard, reviewResultCard, errorCard, successCard } = require('../ui');
const { EMOJI } = require('../theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Monthly partnership review system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('send').setDescription('Manually send the monthly partnership review.')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const count = await sendMonthlyReviews(interaction.client, interaction.guildId);
    await interaction.editReply(successCard(`Monthly review sent to **${count}** partner(s).`));
  },
};

async function sendMonthlyReviews(client, targetGuildId = null) {
  const configs = targetGuildId
    ? await GuildConfig.find({ guildId: targetGuildId })
    : await GuildConfig.find({ reviewChannel: { $ne: null } });

  let total = 0;
  for (const cfg of configs) {
    try {
      if (!cfg.reviewChannel) continue;
      const partners = await Partner.find({ guildId: cfg.guildId });
      if (!partners.length) continue;
      const channel = await client.channels.fetch(cfg.reviewChannel).catch(() => null);
      if (!channel) continue;

      const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

      for (const partner of partners) {
        const card = reviewCard(partner, month, cfg.reviewText, cfg.reviewMode, cfg.reviewLink);
        await channel.send({ content: `<@${partner.representativeId}>`, ...card });
        total++;
      }
    } catch (err) {
      console.error(`[review cron] Error for guild ${cfg.guildId}:`, err);
    }
  }
  return total;
}

async function handleReviewStart(interaction) {
  const partnerId = interaction.customId.split(':')[1];
  const partner   = await Partner.findById(partnerId).catch(() => null);
  if (!partner) return interaction.reply(errorCard('Partner not found.'));

  // Only the representative may answer
  if (interaction.user.id !== partner.representativeId) {
    return interaction.reply(errorCard('Only the partner representative can complete this review.'));
  }

  const cfg       = await GuildConfig.findOne({ guildId: interaction.guildId });
  const questions = (cfg?.reviewQuestions || []).slice(0, 5); // Discord modal max 5 inputs

  const modal = new ModalBuilder()
    .setCustomId(`review_submit:${partnerId}`)
    .setTitle(`Monthly Review — ${partner.name}`.slice(0, 45));

  for (let i = 0; i < questions.length; i++) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(`q${i}`)
        .setLabel(questions[i].slice(0, 45))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    ));
  }

  return interaction.showModal(modal);
}

async function handleReviewSubmit(interaction) {
  const partnerId = interaction.customId.replace('review_submit:', '');
  const partner   = await Partner.findById(partnerId).catch(() => null);
  if (!partner) return interaction.reply(errorCard('Partner not found.'));

  const cfg       = await GuildConfig.findOne({ guildId: interaction.guildId });
  const questions = (cfg?.reviewQuestions || []).slice(0, 5);
  const answers   = questions.map((_, i) => interaction.fields.getTextInputValue(`q${i}`));

  const card = reviewResultCard(partner, answers, questions, interaction.user.id);

  // Post in review channel
  if (cfg?.reviewChannel) {
    const ch = await interaction.client.channels.fetch(cfg.reviewChannel).catch(() => null);
    if (ch) await ch.send(card).catch(() => {});
  }

  // Log
  if (cfg?.logChannel) {
    const ch = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
    if (ch) await ch.send(card).catch(() => {});
  }

  await interaction.reply(successCard('Your review has been submitted. Thank you!'));
}

module.exports.sendMonthlyReviews = sendMonthlyReviews;
module.exports.handleReviewStart  = handleReviewStart;
module.exports.handleReviewSubmit = handleReviewSubmit;
