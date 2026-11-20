'use strict';
const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  ThumbnailBuilder, SectionBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { COLORS, EMOJI, BRAND, PRIORITY_COLOR, PRIORITY_EMOJI } = require('../theme');
const { ts, cap, strikeBar, truncate } = require('../utils/format');

// ─── helpers ────────────────────────────────────────────────────────────────

function footer() {
  return new TextDisplayBuilder().setContent(
    `-# ${EMOJI.coffee} ${BRAND.name} · ${BRAND.sub} · ${ts(new Date(), 'R')}`
  );
}

function sep(divider = true) {
  return new SeparatorBuilder().setDivider(divider).setSpacing(1);
}

function buildContainer(parts, color = COLORS.primary, ephemeral = false) {
  const container = new ContainerBuilder().setAccentColor(color);
  for (const c of parts) {
    if (c instanceof TextDisplayBuilder)      container.addTextDisplayComponents(c);
    else if (c instanceof SeparatorBuilder)   container.addSeparatorComponents(c);
    else if (c instanceof SectionBuilder)     container.addSectionComponents(c);
    else if (c instanceof ActionRowBuilder)   container.addActionRowComponents(c);
    else if (c instanceof MediaGalleryBuilder) container.addMediaGalleryComponents(c);
  }
  let flags = MessageFlags.IsComponentsV2;
  if (ephemeral) flags |= MessageFlags.Ephemeral;
  return { components: [container], flags };
}

/** Wraps components in a Container and returns a sendable payload */
function payload(components, color = COLORS.primary, ephemeral = false) {
  return buildContainer(components, color, ephemeral);
}

// ─── generic cards ──────────────────────────────────────────────────────────

function card({ title, description, color = COLORS.primary, fields = [], buttons = [], ephemeral = false }) {
  const parts = [
    new TextDisplayBuilder().setContent(`## ${title}`),
    sep(),
  ];
  if (description) parts.push(new TextDisplayBuilder().setContent(truncate(description, 3800)));
  for (const f of fields) {
    parts.push(new TextDisplayBuilder().setContent(`**${f.name}**\n${truncate(f.value, 900)}`));
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
  const statusEmoji = EMOJI[partner.status] || EMOJI.active;
  const parts = [
    new TextDisplayBuilder().setContent(`## ${EMOJI.partner} ${partner.name}`),
    sep(),
  ];
  if (BRAND.logoUrl) {
    parts.push(new SectionBuilder().addComponents(
      new TextDisplayBuilder().setContent(
        `${EMOJI.user} **Representative:** <@${partner.representativeId}>\n` +
        `${EMOJI.calendar} **Partner since:** ${ts(partner.addedAt, 'D')}\n` +
        `**Status:** ${statusEmoji} ${cap(partner.status)}`
      ),
      new ThumbnailBuilder().setUrl(BRAND.logoUrl),
    ));
  } else {
    parts.push(new TextDisplayBuilder().setContent(
      `${EMOJI.user} **Representative:** <@${partner.representativeId}>\n` +
      `${EMOJI.calendar} **Partner since:** ${ts(partner.addedAt, 'D')}\n` +
      `**Status:** ${statusEmoji} ${cap(partner.status)}`
    ));
  }
  parts.push(sep(false), row, sep(), footer());
  return payload(parts, COLORS.success, ephemeral);
}

function partnerInfoCard(partner, infractions, lastReview, ticketCount, activeStrikes, strikeLimit) {
  const statusEmoji = EMOJI[partner.status] || EMOJI.active;
  let desc =
    `${EMOJI.user} **Representative:** <@${partner.representativeId}>\n` +
    `${EMOJI.calendar} **Partner since:** ${ts(partner.addedAt, 'D')}\n` +
    `**Status:** ${statusEmoji} ${cap(partner.status)}\n\n` +
    `**Active Infractions:** ${strikeBar(activeStrikes, strikeLimit)}\n` +
    `**Tickets opened:** ${ticketCount}\n`;
  if (lastReview) {
    desc += `**Last review:** ${ts(lastReview.submittedAt, 'D')} by <@${lastReview.submittedBy}>\n`;
  }
  const buttons = [
    new ButtonBuilder().setLabel('Roblox Group').setURL(partner.robloxLink).setStyle(ButtonStyle.Link),
    new ButtonBuilder().setLabel('Discord Server').setURL(partner.discordInvite).setStyle(ButtonStyle.Link),
  ];
  return card({ title: `${EMOJI.partner} ${partner.name}`, description: desc, color: COLORS.success, buttons, ephemeral: true });
}

function partnerListCards(partners, headerText) {
  const messages = [];
  let parts = [new TextDisplayBuilder().setContent(headerText), sep()];
  let count = 2;

  for (const p of partners) {
    const statusEmoji = EMOJI[p.status] || EMOJI.active;
    const textBlock = new TextDisplayBuilder().setContent(
      `**${p.name}** ${statusEmoji}\n${EMOJI.user} <@${p.representativeId}>`
    );
    const rowBlock = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setLabel('Roblox').setURL(p.robloxLink).setStyle(ButtonStyle.Link),
      new ButtonBuilder().setLabel('Discord').setURL(p.discordInvite).setStyle(ButtonStyle.Link),
    );
    const sepBlock = sep(false);

    if (count + 3 + 2 > 35) {
      parts.push(sep(), new TextDisplayBuilder().setContent(`-# ${EMOJI.coffee} ${BRAND.name} · ${BRAND.sub}`));
      messages.push(buildContainer(parts));
      parts = [];
      count = 0;
    }
    parts.push(textBlock, rowBlock, sepBlock);
    count += 3;
  }
  parts.push(sep(), new TextDisplayBuilder().setContent(`-# ${EMOJI.coffee} ${BRAND.name} · ${BRAND.sub} · ${ts(new Date(), 'R')}`));
  messages.push(buildContainer(parts));
  return messages;
}

// ─── infraction cards ────────────────────────────────────────────────────────

function infractionCard(infraction, partner, issuedBy, activeStrikes, strikeLimit, dmFailed = false, forRepresentative = false) {
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
  if (infraction.expiresAt) {
    desc += `\n-# Expires ${ts(infraction.expiresAt, 'D')}`;
  }
  if (dmFailed) desc += `\n\n-# DM could not be delivered to the representative.`;

  // C4: Appeal button only in DM variant
  const buttons = forRepresentative
    ? [
      new ButtonBuilder()
        .setCustomId(`infraction_appeal:${infraction._id}`)
        .setLabel('Appeal')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji(EMOJI.appeal),
    ]
    : [];

  return card({ title: `${emoji} ${typeLabel} Issued`, description: desc, color, buttons, ephemeral: false });
}

function infractionListCard(partner, infractions, page, totalPages, strikeCount, strikeLimit, filter = 'active') {
  const { INFRACTION_COLORS } = require('../theme');
  let desc = `**Partner:** ${partner.name}\n**Strikes:** ${strikeBar(strikeCount, strikeLimit)}\n**Filter:** ${filter}\n\n`;
  for (const inf of infractions) {
    const expired = inf.expired ? ' *(expired)*' : '';
    const removed = inf.removed ? ' *(removed)*' : '';
    desc +=
      `${EMOJI[inf.type]} **${cap(inf.type)}**${expired}${removed} — ${ts(inf.issuedAt, 'D')}\n` +
      `> ${inf.reason}\n` +
      `> By <@${inf.issuedBy}> · \`${inf._id}\`\n\n`;
  }
  if (totalPages > 1) desc += `-# Page ${page + 1}/${totalPages}`;
  return card({ title: `${EMOJI.report} Infractions — ${partner.name}`, description: desc, color: COLORS.dark, ephemeral: true });
}

function infractionEscalationCard(partner, activeStrikes, strikeLimit, infractionId) {
  const desc =
    `${EMOJI.warning} **${partner.name}** has reached **${activeStrikes}/${strikeLimit}** strikes.\n\n` +
    `A staff decision is required.`;
  const buttons = [
    new ButtonBuilder().setCustomId(`infraction_terminate:${infractionId}`).setLabel('Issue Termination').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`infraction_dismiss:${infractionId}`).setLabel('Dismiss').setStyle(ButtonStyle.Secondary),
  ];
  return card({ title: `${EMOJI.strike} Strike Limit Reached — ${partner.name}`, description: desc, color: COLORS.termination, buttons, ephemeral: false });
}

function infractionAppealCard(infraction, partner, appealReason, appealerId) {
  const desc =
    `**Partner:** ${partner.name}\n` +
    `**Infraction:** ${cap(infraction.type)} — ${infraction.reason}\n` +
    `**Appealed by:** <@${appealerId}>\n\n` +
    `**Appeal reason:**\n> ${appealReason}`;
  const buttons = [
    new ButtonBuilder().setCustomId(`appeal_accept:${infraction._id}`).setLabel('Accept Appeal').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`appeal_reject:${infraction._id}`).setLabel('Reject Appeal').setStyle(ButtonStyle.Danger),
  ];
  return card({ title: `${EMOJI.appeal} Infraction Appeal — ${partner.name}`, description: desc, color: COLORS.warning, buttons, ephemeral: false });
}

// ─── ticket cards ────────────────────────────────────────────────────────────

function ticketWelcomeCard(type, user, claimedBy = null, priority = 'normal') {
  const { PRIORITY_COLOR, PRIORITY_EMOJI } = require('../theme');
  let desc = `${type.welcomeText}\n\n**Please answer the following:**\n`;
  type.questions.forEach((q, i) => { desc += `\n**${i + 1}.** ${q}`; });
  if (claimedBy) desc += `\n\n-# ${EMOJI.claim} Claimed by <@${claimedBy}>`;
  if (priority !== 'normal') desc += `\n-# Priority: ${PRIORITY_EMOJI[priority]} ${cap(priority)}`;

  const claimBtn = claimedBy
    ? new ButtonBuilder().setCustomId('ticket_release').setLabel('Release').setStyle(ButtonStyle.Secondary).setEmoji(EMOJI.release)
    : new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Secondary).setEmoji(EMOJI.claim);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji(EMOJI.close),
    claimBtn,
  );
  const parts = [
    new TextDisplayBuilder().setContent(`## ${type.emoji} ${type.name}`),
    sep(),
    new TextDisplayBuilder().setContent(desc),
    sep(false),
    row,
    sep(),
    footer(),
  ];
  return payload(parts, PRIORITY_COLOR[priority] || COLORS.primary);
}

function ticketRatingCard(ticketChannelName, ticketId) {
  const desc = `Your ticket **${ticketChannelName}** has been closed.\nHow would you rate your experience?`;
  const row = new ActionRowBuilder().addComponents(
    ...[1, 2, 3, 4, 5].map(n =>
      new ButtonBuilder().setCustomId(`ticket_rate:${ticketId}:${n}`).setLabel(`${n} ${'⭐'.repeat(n)}`).setStyle(ButtonStyle.Secondary)
    )
  );
  const parts = [
    new TextDisplayBuilder().setContent(`## ${EMOJI.star} Rate Your Experience`),
    sep(),
    new TextDisplayBuilder().setContent(desc),
    sep(false),
    row,
    sep(),
    footer(),
  ];
  return payload(parts, COLORS.primary, false);
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

function reviewStatusCard(month, done, pending) {
  const total = done.length + pending.length;
  const bar = buildProgressBar(done.length, total);
  let desc = `**Month:** ${month}\n**Progress:** ${bar} ${done.length}/${total}\n\n`;
  if (done.length) desc += `**Completed ✅**\n${done.map(p => `> ${p.name}`).join('\n')}\n\n`;
  if (pending.length) desc += `**Pending ⏳**\n${pending.map(p => `> ${p.name}`).join('\n')}`;
  return card({ title: `${EMOJI.review} Review Status — ${month}`, description: desc, color: COLORS.dark, ephemeral: true });
}

function buildProgressBar(done, total, len = 10) {
  if (total === 0) return '▱'.repeat(len);
  const filled = Math.round((done / total) * len);
  return '▰'.repeat(filled) + '▱'.repeat(len - filled);
}

// ─── event cards ─────────────────────────────────────────────────────────────

function eventRequestCard(req, submitter) {
  let desc =
    `**Type:** ${req.type}\n` +
    `**Date:** ${req.date}\n`;
  if (req.startsAt) desc += `**Starts:** ${ts(req.startsAt, 'F')} (${ts(req.startsAt, 'R')})\n`;
  desc += `\n${req.description}\n\n**Submitted by:** <@${submitter}>`;

  const buttons = [
    new ButtonBuilder().setCustomId(`event_approve:${req._id}`).setLabel('Approve').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`event_deny:${req._id}`).setLabel('Deny').setStyle(ButtonStyle.Danger),
  ];
  return card({ title: `${EMOJI.event} Event Request — ${req.title}`, description: desc, color: COLORS.warning, buttons, ephemeral: false });
}

function eventAnnouncementCard(req) {
  let desc =
    `**Type:** ${req.type}\n` +
    `**Date:** ${req.date}\n`;
  if (req.startsAt) desc += `**Starts:** ${ts(req.startsAt, 'F')} (${ts(req.startsAt, 'R')})\n`;
  desc += `\n${req.description}\n\n-# Hosted by <@${req.submitterId}>`;

  const buttons = [
    new ButtonBuilder().setCustomId(`event_interest:${req._id}`).setLabel('I\'m Interested').setStyle(ButtonStyle.Primary).setEmoji(EMOJI.interested),
  ];
  return card({ title: `${EMOJI.event} ${req.type} — ${req.title}`, description: desc, color: COLORS.success, buttons, ephemeral: false });
}

function eventAnnouncementCardWithCount(req, count) {
  let desc =
    `**Type:** ${req.type}\n` +
    `**Date:** ${req.date}\n`;
  if (req.startsAt) desc += `**Starts:** ${ts(req.startsAt, 'F')} (${ts(req.startsAt, 'R')})\n`;
  desc += `\n${req.description}\n\n-# Hosted by <@${req.submitterId}> · ${EMOJI.interested} ${count} interested`;

  const buttons = [
    new ButtonBuilder().setCustomId(`event_interest:${req._id}`).setLabel(`Interested (${count})`).setStyle(ButtonStyle.Primary).setEmoji(EMOJI.interested),
  ];
  return card({ title: `${EMOJI.event} ${req.type} — ${req.title}`, description: desc, color: COLORS.success, buttons, ephemeral: false });
}

function eventDecisionCard(req, status, decidedBy, reason = null) {
  const statusLabel = status === 'approved' ? 'Approved' : 'Denied';
  const statusColor = status === 'approved' ? COLORS.success : COLORS.error;
  const statusEmoji = status === 'approved' ? EMOJI.success : EMOJI.error;

  let desc =
    `**Type:** ${req.type}\n` +
    `**Date:** ${req.date}\n`;
  if (req.startsAt) desc += `**Starts:** ${ts(req.startsAt, 'F')} (${ts(req.startsAt, 'R')})\n`;
  desc += `\n${req.description}\n\n`;
  desc += `**Submitted by:** <@${req.submitterId}>\n`;
  desc += `**${statusLabel} by:** <@${decidedBy}>\n`;
  if (reason) desc += `**Reason:** ${reason}\n`;

  return card({ title: `${EMOJI.event} Event ${statusLabel} — ${req.title}`, description: desc, color: statusColor, ephemeral: false });
}

// ─── config panel ────────────────────────────────────────────────────────────

function configPanel(cfg, rows = []) {
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
    { name: '📋 Review Mode',          value: `${set(cfg?.reviewMode)} ${cfg?.reviewMode === 'dm' ? '💬 In-Discord Form' : '🔗 External Link'}` },
    { name: '🔗 Review Link',          value: `${set(cfg?.reviewLink)} ${cfg?.reviewLink ?? '*Not set*'}` },
  ];

  const complete = fields.filter(f => f.value.startsWith('✅')).length;
  let desc = `-# Setup ${complete}/${fields.length} complete\n\n`;
  for (const f of fields) desc += `${f.value} **${f.name}**\n`;
  if (!cfg?.logChannel) desc += `\n> ${EMOJI.warning} **Recommended:** Set a log channel to track all actions.`;

  const payload = card({ title: `${EMOJI.config} Server Configuration`, description: desc, color: COLORS.dark, ephemeral: true });
  if (rows.length) {
    payload.components = [...payload.components, ...rows];
  }
  return payload;
}

function automationPanel(cfg, rows = []) {
  const a = cfg?.automation || {};
  const on  = (v) => v ? '✅ On' : '❌ Off';
  const val = (v, unit = '') => `\`${v}${unit}\``;

  let desc =
    `**Ticket Inactivity Reminder:** ${on(a.ticketInactivityEnabled)} — after ${val(a.ticketInactivityHours ?? 24, 'h')}\n` +
    `**Ticket Auto-Close:** ${on(a.ticketAutoCloseEnabled)} — after ${val(a.ticketAutoCloseHours ?? 48, 'h')}\n` +
    `**Close Request Timeout:** ${val(a.ticketCloseRequestHours ?? 24, 'h')}\n` +
    `**Max Open Tickets/User:** ${val(a.maxOpenTicketsPerUser ?? 3)}\n` +
    `**Ticket Rating:** ${on(a.ticketRatingEnabled)}\n\n` +
    `**Infraction Expiry (Warning):** ${val(a.infractionExpiryWarning ?? 90, 'd')} *(0 = never)*\n` +
    `**Infraction Expiry (Strike):** ${val(a.infractionExpiryStrike ?? 180, 'd')} *(0 = never)*\n\n` +
    `**Review Reminder:** after ${val(a.reviewReminderDays ?? 7, 'd')}\n` +
    `**Review Overdue:** after ${val(a.reviewOverdueDays ?? 14, 'd')}\n\n` +
    `**Event Reminder:** ${val(a.eventReminderHours ?? 1, 'h')} before\n` +
    `**Anniversary Announcements:** ${on(a.anniversaryAnnouncements)}\n` +
    `**Invite Health Check:** ${on(a.inviteHealthCheck)}\n` +
    `**Auto-Assign Rep Roles:** ${on(a.autoAssignRepRoles)}\n` +
    `**Weekly Event Digest:** ${on(a.weeklyEventDigest)}`;

  const payload = card({ title: `${EMOJI.config} Automation Settings`, description: desc, color: COLORS.dark, ephemeral: true });
  if (rows.length) {
    payload.components = [...payload.components, ...rows];
  }
  return payload;
}

// ─── log card ────────────────────────────────────────────────────────────────

function logCard(title, description, color = COLORS.dark) {
  return card({ title: `${EMOJI.log} ${title}`, description, color, ephemeral: false });
}

// ─── stats card ──────────────────────────────────────────────────────────────

function statsCard(data) {
  const desc =
    `**Partners:** ${data.totalPartners} (${data.activePartners} active, ${data.probationPartners} probation)\n` +
    `**Open Tickets:** ${data.openTickets}\n` +
    `**Tickets This Month:** ${data.ticketsThisMonth}\n` +
    `**Avg. First Reply:** ${data.avgFirstReply}\n` +
    `**Review Completion:** ${buildProgressBar(data.reviewDone, data.reviewTotal)} ${data.reviewDone}/${data.reviewTotal}\n` +
    `**Active Infractions:** ${data.activeInfractions}\n` +
    `**Upcoming Events:** ${data.upcomingEvents}\n` +
    `-# Uptime: ${data.uptime}`;
  return card({ title: `${EMOJI.stats} Server Stats`, description: desc, color: COLORS.dark, ephemeral: true });
}

// ─── doctor card ─────────────────────────────────────────────────────────────

function doctorCard(checks) {
  let desc = '';
  for (const c of checks) {
    desc += `${c.ok === true ? '✅' : c.ok === 'warn' ? '⚠️' : '❌'} **${c.name}**`;
    if (c.detail) desc += `\n> ${c.detail}`;
    desc += '\n';
  }
  const allOk = checks.every(c => c.ok === true);
  return card({ title: `${EMOJI.doctor} Bot Health Check`, description: desc, color: allOk ? COLORS.success : COLORS.warning, ephemeral: true });
}

// ─── audit card ──────────────────────────────────────────────────────────────

function auditCard(entries, page, totalPages) {
  let desc = '';
  for (const e of entries) {
    desc += `${ts(e.createdAt, 'R')} **${e.action}** by <@${e.actorId}>`;
    if (e.targetType) desc += ` · ${e.targetType}`;
    desc += '\n';
  }
  if (totalPages > 1) desc += `\n-# Page ${page + 1}/${totalPages}`;
  return card({ title: `${EMOJI.audit} Audit Log`, description: desc || '*No entries.*', color: COLORS.dark, ephemeral: true });
}

module.exports = {
  payload, card, buildContainer, buildProgressBar,
  successCard, errorCard, warningCard, infoCard,
  partnerCard, partnerInfoCard, partnerListCards,
  infractionCard, infractionListCard, infractionEscalationCard, infractionAppealCard,
  ticketWelcomeCard, ticketRatingCard,
  reviewCard, reviewResultCard, reviewStatusCard,
  eventRequestCard, eventAnnouncementCard, eventAnnouncementCardWithCount, eventDecisionCard,
  configPanel, automationPanel, logCard,
  statsCard, doctorCard, auditCard,
};
