'use strict';
const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  ThumbnailBuilder, SectionBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { COLORS, EMOJI, BRAND } = require('../theme');
const { ts, cap, strikeBar } = require('../utils/format');

// ─── helpers ────────────────────────────────────────────────────────────────

function footer() {
  return new TextDisplayBuilder().setContent(
    `-# ${EMOJI.coffee} ${BRAND.name} · ${BRAND.sub} · ${ts(new Date(), 'R')}`
  );
}

function sep(divider = true) {
  return new SeparatorBuilder().setDivider(divider).setSpacing(1);
}

/** Wraps components in a Container and returns a sendable payload */
function payload(components, color = COLORS.primary, ephemeral = false) {
  const container = new ContainerBuilder().setAccentColor(color);
  for (const c of components) container.addComponent(c);
  let flags = MessageFlags.IsComponentsV2;
  if (ephemeral) flags |= MessageFlags.Ephemeral;
  return { components: [container], flags };
}

// ─── generic cards ──────────────────────────────────────────────────────────

function card({ title, description, color = COLORS.primary, fields = [], buttons = [], ephemeral = false }) {
  const parts = [
    new TextDisplayBuilder().setContent(`## ${title}`),
    sep(),
  ];
  if (description) parts.push(new TextDisplayBuilder().setContent(description));
  for (const f of fields) {
    parts.push(new TextDisplayBuilder().setContent(`**${f.name}**\n${f.value}`));
  }
  if (buttons.length) {
    const row = new ActionRowBuilder();
    for (const b of buttons) row.addComponents(b);
    parts.push(sep(false), row);
  }
  parts.push(sep(), footer());
  return payload(parts, color, ephemeral);
}

function successCard(msg, ephemeral = true) {
  return card({ title: `${EMOJI.success} Success`, description: msg, color: COLORS.success, ephemeral });
}

function errorCard(msg, ephemeral = true) {
  return card({ title: `${EMOJI.error} Error`, description: msg, color: COLORS.error, ephemeral });
}

function warningCard(msg, ephemeral = true) {
  return card({ title: `${EMOJI.warning} Warning`, description: msg, color: COLORS.warning, ephemeral });
}

function infoCard(title, description, ephemeral = true) {
  return card({ title, description, color: COLORS.primary, ephemeral });
}

// ─── partner cards ───────────────────────────────────────────────────────────

function partnerCard(partner, ephemeral = false) {
  const buttons = [
    new ButtonBuilder().setLabel('Roblox Group').setURL(partner.robloxLink).setStyle(ButtonStyle.Link),
    new ButtonBuilder().setLabel('Discord Server').setURL(partner.discordInvite).setStyle(ButtonStyle.Link),
  ];
  const row = new ActionRowBuilder().addComponents(...buttons);
  const parts = [
    new TextDisplayBuilder().setContent(`## ${EMOJI.partner} ${partner.name}`),
    sep(),
    new TextDisplayBuilder().setContent(
      `${EMOJI.user} **Representative:** <@${partner.representativeId}>\n` +
      `${EMOJI.calendar} **Partner since:** ${ts(partner.addedAt, 'D')}`
    ),
    sep(false),
    row,
    sep(),
    footer(),
  ];
  return payload(parts, COLORS.success, ephemeral);
}

function partnerListCards(partners, headerText) {
  // Split into multiple payloads if needed (max 35 components per message)
  const messages = [];
  let parts = [new TextDisplayBuilder().setContent(headerText), sep()];
  let count = 2;

  for (const p of partners) {
    const block = [
      new TextDisplayBuilder().setContent(
        `**${p.name}**\n` +
        `${EMOJI.user} <@${p.representativeId}>`
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Roblox').setURL(p.robloxLink).setStyle(ButtonStyle.Link),
        new ButtonBuilder().setLabel('Discord').setURL(p.discordInvite).setStyle(ButtonStyle.Link),
      ),
      sep(false),
    ];
    if (count + block.length + 2 > 35) {
      parts.push(footer());
      messages.push(payload(parts, COLORS.primary));
      parts = [];
      count = 0;
    }
    parts.push(...block);
    count += block.length;
  }
  parts.push(footer());
  messages.push(payload(parts, COLORS.primary));
  return messages;
}

// ─── infraction cards ────────────────────────────────────────────────────────

function infractionCard(infraction, partner, issuedBy, activeStrikes, strikeLimit, dmFailed = false) {
  const { INFRACTION_COLORS } = require('../theme');
  const color = INFRACTION_COLORS[infraction.type];
  const typeLabel = cap(infraction.type);
  const emoji = EMOJI[infraction.type];

  let desc =
    `${EMOJI.user} **Partner:** ${partner.name}\n` +
    `**Reason:** ${infraction.reason}\n` +
    `**Issued by:** <@${issuedBy}>\n` +
    `**Date:** ${ts(infraction.issuedAt, 'D')}\n` +
    `**ID:** \`${infraction._id}\``;

  if (infraction.type === 'strike') {
    desc += `\n\n**Strikes:** ${strikeBar(activeStrikes, strikeLimit)}`;
    if (activeStrikes >= strikeLimit) {
      desc += `\n\n> ${EMOJI.warning} **Strike limit reached — review for termination.**`;
    }
  }
  if (dmFailed) desc += `\n\n-# DM could not be delivered to the representative.`;

  return card({ title: `${emoji} ${typeLabel} Issued`, description: desc, color, ephemeral: false });
}

function infractionListCard(partner, infractions, page, totalPages, strikeCount, strikeLimit) {
  const { INFRACTION_COLORS } = require('../theme');
  let desc = `**Partner:** ${partner.name}\n**Strikes:** ${strikeBar(strikeCount, strikeLimit)}\n\n`;
  for (const inf of infractions) {
    desc +=
      `${EMOJI[inf.type]} **${cap(inf.type)}** — ${ts(inf.issuedAt, 'D')}\n` +
      `> ${inf.reason}\n` +
      `> By <@${inf.issuedBy}> · \`${inf._id}\`\n\n`;
  }
  if (totalPages > 1) desc += `-# Page ${page + 1}/${totalPages}`;
  return card({ title: `${EMOJI.report} Infractions — ${partner.name}`, description: desc, color: COLORS.dark, ephemeral: true });
}

// ─── ticket cards ────────────────────────────────────────────────────────────

function ticketWelcomeCard(type, user, claimedBy = null) {
  let desc = `${type.welcomeText}\n\n**Please answer the following:**\n`;
  type.questions.forEach((q, i) => { desc += `\n**${i + 1}.** ${q}`; });
  if (claimedBy) desc += `\n\n-# Claimed by <@${claimedBy}>`;

  const buttons = [
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji(EMOJI.close),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Secondary).setEmoji(EMOJI.claim),
  ];
  const row = new ActionRowBuilder().addComponents(...buttons);
  const parts = [
    new TextDisplayBuilder().setContent(`## ${type.emoji} ${type.name}`),
    sep(),
    new TextDisplayBuilder().setContent(desc),
    sep(false),
    row,
    sep(),
    footer(),
  ];
  return payload(parts, COLORS.primary);
}

// ─── review cards ────────────────────────────────────────────────────────────

function reviewCard(partner, month, reviewText, mode, reviewLink = null) {
  const desc =
    `${reviewText}\n\n` +
    `**Partner:** ${partner.name}\n` +
    `**Representative:** <@${partner.representativeId}>\n` +
    `${EMOJI.roblox} [Roblox Group](${partner.robloxLink}) · ${EMOJI.discord} [Discord](${partner.discordInvite})`;

  const buttons = [];
  if (mode === 'link' && reviewLink) {
    buttons.push(new ButtonBuilder().setLabel('Complete Review').setURL(reviewLink).setStyle(ButtonStyle.Link));
  } else {
    buttons.push(new ButtonBuilder().setCustomId(`review_start:${partner._id}`).setLabel('Start Review').setStyle(ButtonStyle.Primary));
  }

  return card({ title: `${EMOJI.review} Monthly Review — ${month}`, description: desc, color: COLORS.dark, buttons, ephemeral: false });
}

function reviewResultCard(partner, answers, questions, submittedBy) {
  let desc = `**Partner:** ${partner.name}\n**Submitted by:** <@${submittedBy}>\n\n`;
  questions.forEach((q, i) => {
    desc += `**${i + 1}. ${q}**\n> ${answers[i] ?? '*No answer*'}\n\n`;
  });
  return card({ title: `${EMOJI.review} Review Submitted — ${partner.name}`, description: desc, color: COLORS.success, ephemeral: false });
}

// ─── event cards ─────────────────────────────────────────────────────────────

function eventRequestCard(req, submitter) {
  const desc =
    `**Type:** ${req.type}\n` +
    `**Date:** ${req.date}\n\n` +
    `${req.description}\n\n` +
    `**Submitted by:** <@${submitter}>`;

  const buttons = [
    new ButtonBuilder().setCustomId(`event_approve:${req._id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`event_deny:${req._id}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
  ];
  return card({ title: `${EMOJI.event} Event Request — ${req.title}`, description: desc, color: COLORS.warning, buttons, ephemeral: false });
}

function eventAnnouncementCard(req) {
  const desc =
    `**Type:** ${req.type}\n` +
    `**Date:** ${req.date}\n\n` +
    `${req.description}\n\n` +
    `-# Hosted by <@${req.submitterId}>`;
  return card({ title: `${EMOJI.event} ${req.type} — ${req.title}`, description: desc, color: COLORS.success, ephemeral: false });
}

// ─── config panel ────────────────────────────────────────────────────────────

function configPanel(cfg) {
  const set = (v) => v ? `✅` : `⚠️`;
  const ch  = (id) => id ? `<#${id}>` : '*Not set*';
  const ro  = (ids) => ids?.length ? ids.map(r => `<@&${r}>`).join(', ') : '*Not set*';

  const fields = [
    { name: '📢 Announcement Channel', value: `${set(cfg?.announcementChannel)} ${ch(cfg?.announcementChannel)}` },
    { name: '📋 Review Channel',       value: `${set(cfg?.reviewChannel)} ${ch(cfg?.reviewChannel)}` },
    { name: '📝 Log Channel',          value: `${set(cfg?.logChannel)} ${ch(cfg?.logChannel)}` },
    { name: '📃 Partner List Channel', value: `${set(cfg?.partnerListChannel)} ${ch(cfg?.partnerListChannel)}` },
    { name: '🎫 Ticket Category',      value: `${set(cfg?.ticketCategory)} ${ch(cfg?.ticketCategory)}` },
    { name: '👔 PR Staff Roles',       value: `${set(cfg?.prStaffRoles?.length)} ${ro(cfg?.prStaffRoles)}` },
    { name: '🤝 Partner Rep Roles',    value: `${set(cfg?.partnerRepRoles?.length)} ${ro(cfg?.partnerRepRoles)}` },
    { name: '📋 Review Mode',          value: `${set(cfg?.reviewMode)} ${cfg?.reviewMode === 'dm' ? '💬 DM Questions' : '🔗 External Link'}` },
    { name: '🔗 Review Link',          value: `${set(cfg?.reviewLink)} ${cfg?.reviewLink ?? '*Not set*'}` },
  ];

  const complete = fields.filter(f => f.value.startsWith('✅')).length;
  let desc = `-# Setup ${complete}/${fields.length} complete\n\n`;
  for (const f of fields) desc += `${f.value} **${f.name}**\n`;

  if (!cfg?.logChannel) desc += `\n> ${EMOJI.warning} **Recommended:** Set a log channel to track all actions.`;

  return card({ title: `${EMOJI.config} Server Configuration`, description: desc, color: COLORS.dark, ephemeral: true });
}

// ─── log card ────────────────────────────────────────────────────────────────

function logCard(title, description, color = COLORS.dark) {
  return card({ title: `${EMOJI.log} ${title}`, description, color, ephemeral: false });
}

module.exports = {
  payload, card, successCard, errorCard, warningCard, infoCard,
  partnerCard, partnerListCards,
  infractionCard, infractionListCard,
  ticketWelcomeCard,
  reviewCard, reviewResultCard,
  eventRequestCard, eventAnnouncementCard,
  configPanel, logCard,
};
