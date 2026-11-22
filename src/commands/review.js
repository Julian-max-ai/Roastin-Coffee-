'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const GuildConfig        = require('../models/GuildConfig');
const Partner            = require('../models/Partner');
const ReviewSubmission   = require('../models/ReviewSubmission');
const ReviewRequest      = require('../models/ReviewRequest');
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
    : await GuildConfig.find({});

  let total = 0;
  for (const cfg of configs) {
    try {
      const partners = await Partner.find({ guildId: cfg.guildId, status: 'active' });
      if (!partners.length) continue;

      const month = currentMonth();

      for (const partner of partners) {
        // Check if already sent this month
        const ReviewRequest = require('../models/ReviewRequest');
        const existing = await ReviewRequest.findOne({ guildId: cfg.guildId, partnerId: partner._id, month }).catch(() => null);
        if (existing) continue;

        // Resolve partner channel
        let channel = null;
        if (partner.channelId) {
          channel = await client.channels.fetch(partner.channelId).catch(() => null);
        }
        if (!channel) {
          await Partner.findByIdAndUpdate(partner._id, { channelMissing: true }).catch(() => {});
          if (cfg.logChannel) {
            const logCh = await client.channels.fetch(cfg.logChannel).catch(() => {});
            if (logCh) await logCh.send(errorCard(`Partner **${partner.name}** channel is missing or inaccessible.`)).catch(() => {});
          }
          continue;
        }

        const reps = partner.representativeIds?.length ? partner.representativeIds : [partner.representativeId];

        // Ping all reps
        await channel.send({ content: reps.map(r => `<@${r}>`).join(' '), allowedMentions: { users: reps } }).catch(() => {});

        // Send review card with partner links
        const { getText } = require('../utils/texts');
        const reviewText = getText(cfg, 'review_intro', { partner: partner.name, rep: `<@${partner.representativeId}>`, month });
        const card = reviewCard(partner, month, reviewText, cfg.reviewMode, cfg.reviewLink);
        const msg = await channel.send(card).catch(() => null);

        total++;

        // Create ReviewRequest after successful send
        await ReviewRequest.findOneAndUpdate(
          { guildId: cfg.guildId, partnerId: partner._id, month },
          { guildId: cfg.guildId, partnerId: partner._id, month, status: 'pending', channelId: channel.id, messageId: msg?.id, createdAt: new Date() },
          { upsert: true }
        ).catch(() => {});

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

  const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
  const reps = partner.representativeIds?.length ? partner.representativeIds : [partner.representativeId];
  const isRep = reps.includes(interaction.user.id);
  const isStaffUser = require('../utils/permissions').isStaff(interaction.member, cfg);
  if (!isRep && !isStaffUser) {
    return interaction.reply(errorCard('Only the partner representative or staff can complete this review.'));
  }

  const month = currentMonth();
  const existing = await ReviewSubmission.findOne({ guildId: interaction.guildId, partnerId, month });
  if (existing) return interaction.reply(errorCard('You have already submitted a review for this month.'));

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

  // Send to partner channel
  if (partner.channelId) {
    const ch = await interaction.client.channels.fetch(partner.channelId).catch(() => null);
    if (ch) await ch.send(card).catch(() => {});
  }
  // Send copy to log channel
  if (cfg?.logChannel) {
    const ch = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
    if (ch) await ch.send(card).catch(() => {});
  }

  // Update ReviewRequest to done
  const ReviewRequest = require('../models/ReviewRequest');
  await ReviewRequest.findOneAndUpdate(
    { guildId: interaction.guildId, partnerId, month },
    { status: 'done', completedAt: new Date(), completedBy: interaction.user.id }
  ).catch(() => {});

  // Edit original card if messageId exists
  const rr = await ReviewRequest.findOne({ guildId: interaction.guildId, partnerId, month }).catch(() => null);
  if (rr?.messageId && partner.channelId) {
    const ch = await interaction.client.channels.fetch(partner.channelId).catch(() => null);
    if (ch) {
      const msg = await ch.messages.fetch(rr.messageId).catch(() => null);
      if (msg) await msg.edit(card).catch(() => {});
    }
  }

  await audit(interaction.guildId, interaction.user.id, 'review_submit', 'partner', partnerId, { month });
  return interaction.reply(successCard('Your review has been submitted. Thank you!'));
}

module.exports.sendMonthlyReviews = sendMonthlyReviews;
module.exports.handleReviewStart  = handleReviewStart;
module.exports.handleReviewSubmit = handleReviewSubmit;
module.exports.currentMonth       = currentMonth;
