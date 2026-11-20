'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const GuildConfig        = require('../models/GuildConfig');
const Partner            = require('../models/Partner');
const ReviewSubmission   = require('../models/ReviewSubmission');
const { reviewCard, reviewResultCard, reviewStatusCard, errorCard, successCard, logCard } = require('../ui');
const { EMOJI } = require('../theme');
const { audit } = require('../utils/audit');

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel() {
  return new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Monthly partnership review system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('send').setDescription('Manually send the monthly partnership review.'))
    .addSubcommand(s => s.setName('status').setDescription('Show review completion status for the current month.')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();

    if (sub === 'send') {
      const count = await sendMonthlyReviews(interaction.client, interaction.guildId);
      return interaction.editReply(successCard(`Monthly review sent to **${count}** partner(s).`));
    }

    if (sub === 'status') {
      const { guildId } = interaction;
      const month = currentMonth();
      const partners = await Partner.find({ guildId });
      if (!partners.length) return interaction.editReply(errorCard('No partners found.'));

      const submissions = await ReviewSubmission.find({ guildId, month });
      const doneIds = new Set(submissions.map(s => s.partnerId.toString()));
      const done    = partners.filter(p => doneIds.has(p._id.toString()));
      const pending = partners.filter(p => !doneIds.has(p._id.toString()));

      return interaction.editReply(reviewStatusCard(monthLabel(), done, pending));
    }
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

      const month = monthLabel();

      for (const partner of partners) {
        const card = reviewCard(partner, month, cfg.reviewText, cfg.reviewMode, cfg.reviewLink);
        // V2 fix: ping and card are separate messages
        await channel.send({ content: `<@${partner.representativeId}>`, allowedMentions: { users: [partner.representativeId] } });
        await channel.send(card);
        total++;
        // Small pause to respect rate limits
        await new Promise(r => setTimeout(r, 500));
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

  if (interaction.user.id !== partner.representativeId) {
    return interaction.reply(errorCard('Only the partner representative can complete this review.'));
  }

  const month = currentMonth();
  const existing = await ReviewSubmission.findOne({ guildId: interaction.guildId, partnerId, month });
  if (existing) return interaction.reply(errorCard('You have already submitted a review for this month.'));

  const cfg       = await GuildConfig.findOne({ guildId: interaction.guildId });
  const questions = (cfg?.reviewQuestions || []).slice(0, 5);

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
  const month     = currentMonth();

  // Idempotent: upsert so double-submit doesn't error
  await ReviewSubmission.findOneAndUpdate(
    { guildId: interaction.guildId, partnerId, month },
    { answers, submittedBy: interaction.user.id, submittedAt: new Date() },
    { upsert: true }
  );

  const card = reviewResultCard(partner, answers, questions, interaction.user.id);

  if (cfg?.reviewChannel) {
    const ch = await interaction.client.channels.fetch(cfg.reviewChannel).catch(() => null);
    if (ch) await ch.send(card).catch(() => {});
  }
  if (cfg?.logChannel) {
    const ch = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
    if (ch) await ch.send(card).catch(() => {});
  }

  await audit(interaction.guildId, interaction.user.id, 'review_submit', 'partner', partnerId, { month });
  return interaction.reply(successCard('Your review has been submitted. Thank you!'));
}

module.exports.sendMonthlyReviews = sendMonthlyReviews;
module.exports.handleReviewStart  = handleReviewStart;
module.exports.handleReviewSubmit = handleReviewSubmit;
module.exports.currentMonth       = currentMonth;
