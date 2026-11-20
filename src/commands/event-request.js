'use strict';
const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const EventRequest = require('../models/EventRequest');
const GuildConfig  = require('../models/GuildConfig');
const { eventRequestCard, eventAnnouncementCard, eventAnnouncementCardWithCount, errorCard, successCard, logCard } = require('../ui');
const { isStaff } = require('../utils/permissions');
const { EMOJI, EVENT_REQUEST_COOLDOWN_MS } = require('../theme');
const { audit } = require('../utils/audit');

const cooldowns = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event-request')
    .setDescription('Submit an affiliate event or shift for staff approval.')
    .addStringOption(o => o.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Event description').setRequired(true))
    .addStringOption(o => o.setName('date').setDescription('Date & time (e.g. July 20, 2025 at 3PM UTC)').setRequired(true))
    .addStringOption(o => o.setName('type').setDescription('Type').setRequired(true)
      .addChoices({ name: 'Event', value: 'Event' }, { name: 'Shift', value: 'Shift' }))
    .addStringOption(o => o.setName('time').setDescription('Structured time: YYYY-MM-DD HH:mm (UTC)').setRequired(false)),

  async execute(interaction) {
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!cfg?.announcementChannel) return interaction.reply(errorCard('No announcement channel configured. Ask an admin to run `/config`.'));

    const key  = `${guildId}:${interaction.user.id}`;
    const last = cooldowns.get(key) || 0;
    if (Date.now() - last < EVENT_REQUEST_COOLDOWN_MS) {
      const remaining = Math.ceil((EVENT_REQUEST_COOLDOWN_MS - (Date.now() - last)) / 1000);
      return interaction.reply(errorCard(`Please wait ${remaining}s before submitting another event request.`));
    }
    cooldowns.set(key, Date.now());

    const timeStr = interaction.options.getString('time');
    let startsAt = null;
    if (timeStr) {
      const parsed = new Date(timeStr.replace(' ', 'T') + ':00Z');
      if (!isNaN(parsed.getTime())) startsAt = parsed;
    }

    const req = await EventRequest.create({
      guildId,
      submitterId:  interaction.user.id,
      title:        interaction.options.getString('title'),
      description:  interaction.options.getString('description'),
      date:         interaction.options.getString('date'),
      type:         interaction.options.getString('type'),
      startsAt,
    });

    const card = eventRequestCard(req, interaction.user.id);
    const targetChannelId = cfg.logChannel || cfg.announcementChannel;
    const ch = await interaction.client.channels.fetch(targetChannelId).catch(() => null);
    if (ch) {
      const msg = await ch.send(card).catch(() => null);
      if (msg) await EventRequest.findByIdAndUpdate(req._id, { logMessageId: msg.id });
    }

    await audit(guildId, interaction.user.id, 'event_request', 'event', req._id.toString(), { title: req.title });
    return interaction.reply(successCard('Your event request has been submitted for staff review.'));
  },
};

async function handleEventDecision(interaction) {
  const [action, reqId] = interaction.customId.split(':');
  const { guildId, member } = interaction;

  const cfg = await GuildConfig.findOne({ guildId });
  if (!isStaff(member, cfg)) return interaction.reply(errorCard('You need the PR Staff role to approve or deny event requests.'));

  const req = await EventRequest.findOne({ _id: reqId, guildId }).catch(() => null);
  if (!req) return interaction.reply(errorCard('Event request not found.'));
  if (req.status !== 'pending') return interaction.reply(errorCard('This request has already been decided.'));

  if (action === 'event_deny') {
    const modal = new ModalBuilder().setCustomId(`event_deny_reason:${reqId}`).setTitle('Deny Event Request');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('reason').setLabel('Reason for denial (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false)
    ));
    return interaction.showModal(modal);
  }

  // Approve
  await EventRequest.findByIdAndUpdate(reqId, { status: 'approved', decidedBy: interaction.user.id, decidedAt: new Date() });

  const announceCh = await interaction.client.channels.fetch(cfg.announcementChannel).catch(() => null);
  let announceMsg = null;
  if (announceCh) {
    announceMsg = await announceCh.send(eventAnnouncementCard(req)).catch(() => null);
    if (announceMsg) await EventRequest.findByIdAndUpdate(reqId, { announceMsgId: announceMsg.id });
  }

  // V2 fix: update the request card to show approved state — no components:[]
  await interaction.update(logCard(
    `${EMOJI.event} Event Approved — ${req.title}`,
    `Approved by <@${interaction.user.id}>${announceMsg ? `\nAnnounced in <#${cfg.announcementChannel}>` : ''}`
  ));

  await audit(guildId, interaction.user.id, 'event_approve', 'event', reqId, { title: req.title });
  await require('./partner').sendLog(interaction.client, guildId,
    `${EMOJI.event} Event Approved — ${req.title}`,
    `Approved by <@${interaction.user.id}>`
  );
}

async function handleEventDenyModal(interaction) {
  const reqId  = interaction.customId.replace('event_deny_reason:', '');
  const reason = interaction.fields.getTextInputValue('reason') || null;
  const { guildId } = interaction;

  await EventRequest.findByIdAndUpdate(reqId, { status: 'denied', decidedBy: interaction.user.id, decidedAt: new Date(), denyReason: reason });
  const req = await EventRequest.findById(reqId);

  try {
    const user = await interaction.client.users.fetch(req.submitterId);
    await user.send(errorCard(
      `Your event request **${req.title}** was denied by <@${interaction.user.id}>.` +
      (reason ? `\n\n**Reason:** ${reason}` : ''), false
    ));
  } catch {}

  // V2 fix: update to a log card — no components:[]
  await interaction.update(logCard(
    `${EMOJI.event} Event Denied — ${req.title}`,
    `Denied by <@${interaction.user.id}>${reason ? `\n**Reason:** ${reason}` : ''}`
  ));

  await audit(guildId, interaction.user.id, 'event_deny', 'event', reqId, { title: req.title, reason });
}

async function handleEventInterest(interaction) {
  await interaction.deferUpdate();
  const reqId = interaction.customId.replace('event_interest:', '');
  const userId = interaction.user.id;

  const req = await EventRequest.findById(reqId);
  if (!req || req.status !== 'approved') return;

  const already = req.interestedUserIds.includes(userId);
  if (already) {
    await EventRequest.findByIdAndUpdate(reqId, { $pull: { interestedUserIds: userId } });
  } else {
    await EventRequest.findByIdAndUpdate(reqId, { $addToSet: { interestedUserIds: userId } });
  }

  const updated = await EventRequest.findById(reqId);
  await interaction.editReply(eventAnnouncementCardWithCount(updated, updated.interestedUserIds.length));
}

module.exports.handleEventDecision  = handleEventDecision;
module.exports.handleEventDenyModal = handleEventDenyModal;
module.exports.handleEventInterest  = handleEventInterest;
