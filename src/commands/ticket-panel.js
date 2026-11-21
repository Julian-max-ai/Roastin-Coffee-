'use strict';
const {
  SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, PermissionsBitField,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const GuildConfig  = require('../models/GuildConfig');
const TicketType   = require('../models/TicketType');
const Ticket       = require('../models/Ticket');
const { ticketWelcomeCard, ticketRatingCard, errorCard, successCard, logCard, infoCard, card, warningCard } = require('../ui');
const { isStaff } = require('../utils/permissions');
const { getText } = require('../utils/texts');
const { EMOJI, TICKET_CLOSE_DELAY_MS, PRIORITY_EMOJI, PRIORITY_COLOR, COLORS } = require('../theme');
const { audit } = require('../utils/audit');
const { ts } = require('../utils/format');

const DEFAULT_TYPES = [
  {
    customId: 'general', name: 'General Question', emoji: '💬',
    questions: ['What is your question?', 'Is this related to an existing partnership?', 'How can we best assist you?'],
    welcomeText: 'Thank you for reaching out! A PR staff member will be with you shortly.',
  },
  {
    customId: 'partnership', name: 'Partnership Request', emoji: '🤝',
    questions: [
      'What is the name of your Roblox group/community?',
      'What is your Roblox group link?',
      'What is your Discord server invite link?',
      'How many members does your group have?',
      'Why do you want to partner with Roastin Coffee?',
      'What can you offer as a partner?',
    ],
    welcomeText: 'Thank you for your partnership interest! Please answer the questions below.',
  },
  {
    customId: 'report', name: 'PR Report', emoji: '📋',
    questions: [
      'Who or what are you reporting?',
      'What happened? Please describe in detail.',
      'When did this occur?',
      'Do you have any evidence (screenshots, links)?',
    ],
    welcomeText: 'Thank you for your report. This ticket is confidential. A senior PR staff member will review it shortly.',
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage the ticket system.')
    .addSubcommand(s => s.setName('setup').setDescription('Initialize the 3 default ticket types (admin only).'))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a ticket type (admin only).')
      .addStringOption(o => o.setName('type').setDescription('Ticket type').setRequired(true)
        .addChoices(
          { name: '💬 General Question', value: 'general' },
          { name: '🤝 Partnership Request', value: 'partnership' },
          { name: '📋 PR Report', value: 'report' },
        )))
    .addSubcommand(s => s.setName('add').setDescription('Add a user to this ticket (staff only).')
      .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Remove a user from this ticket (staff only).')
      .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(s => s.setName('rename').setDescription('Rename this ticket channel (staff only).')
      .addStringOption(o => o.setName('name').setDescription('New channel name').setRequired(true)))
    .addSubcommand(s => s.setName('priority').setDescription('Set ticket priority (staff only).')
      .addStringOption(o => o.setName('level').setDescription('Priority level').setRequired(true)
        .addChoices(
          { name: '🔵 Low', value: 'low' },
          { name: '⚪ Normal', value: 'normal' },
          { name: '🟡 High', value: 'high' },
          { name: '🔴 Urgent', value: 'urgent' },
        )))
    .addSubcommand(s => s.setName('close-request').setDescription('Request ticket closure with optional reason (staff only).')
      .addStringOption(o => o.setName('reason').setDescription('Reason for closure').setRequired(false))),

  async execute(interaction) {
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply(errorCard('Only administrators can run `/ticket setup`.'));
      }
      for (const t of DEFAULT_TYPES) {
        await TicketType.findOneAndUpdate({ guildId, customId: t.customId }, { ...t, guildId }, { upsert: true });
      }
      return interaction.reply(successCard(
        `**3 ticket types initialized.**\n\n` +
        `In dweeb.faizo.net, set button customIds to:\n` +
        `> \`ticket_open:general\`\n` +
        `> \`ticket_open:partnership\`\n` +
        `> \`ticket_open:report\`\n\n` +
        `Use \`/ticket edit\` to customize questions and welcome texts.\n` +
        `Close, Claim, Release and Request Close buttons appear automatically on the welcome card.`
      ));
    }


    if (sub === 'edit') {
      if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply(errorCard('Only administrators can run `/ticket edit`.'));
      }
      const typeId = interaction.options.getString('type');
      const type   = await TicketType.findOne({ guildId, customId: typeId });
      if (!type) return interaction.reply(errorCard('Run `/ticket setup` first.'));

      const modal = new ModalBuilder().setCustomId(`ticket_edit:${typeId}`).setTitle(`Edit ${type.name}`.slice(0, 45));
      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('welcome_text').setLabel('Welcome Text').setStyle(TextInputStyle.Paragraph).setValue(type.welcomeText).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('questions').setLabel('Questions (one per line)').setStyle(TextInputStyle.Paragraph).setValue(type.questions.join('\n')).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('staff_roles').setLabel('Staff Role IDs (comma separated)').setStyle(TextInputStyle.Short).setValue(type.staffRoles.join(', ')).setRequired(false)
        ),
      );
      return interaction.showModal(modal);
    }

    // ── Ticket-channel-only subcommands (staff only) ──────────────────────
    await interaction.deferReply({ ephemeral: true });
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) {
      return interaction.editReply(errorCard('Only staff can use ticket channel commands.'));
    }

    const ticket = await Ticket.findOne({ guildId, channelId: interaction.channelId, status: 'open' });
    if (!ticket) return interaction.editReply(errorCard('This command can only be used inside an open ticket channel.'));

    if (sub === 'add') {
      const user = interaction.options.getUser('user');
      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      });
      return interaction.editReply(successCard(`<@${user.id}> has been added to this ticket.`));
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('user');
      if (user.id === ticket.userId) return interaction.editReply(errorCard('Cannot remove the ticket creator.'));
      await interaction.channel.permissionOverwrites.delete(user.id).catch(() => {});
      return interaction.editReply(successCard(`<@${user.id}> has been removed from this ticket.`));
    }

    if (sub === 'rename') {
      const name = interaction.options.getString('name');
      const customName = name ? name.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 20) : null;
      await Ticket.findByIdAndUpdate(ticket._id, { customName });
      const type = await TicketType.findOne({ guildId, customId: ticket.typeId });
      const { syncTicketChannel } = require('../utils/ticketNaming');
      try {
        await syncTicketChannel(interaction.channel, await Ticket.findById(ticket._id), type?.customId || 'ticket');
      } catch (err) {
        console.error('[ticket rename] channel rename failed:', err.message);
      }
      return interaction.editReply(successCard(`Ticket renamed. Channel name will be updated.`));
    }

    if (sub === 'priority') {
      const level = interaction.options.getString('level');
      await Ticket.findByIdAndUpdate(ticket._id, { priority: level });

      const type = await TicketType.findOne({ guildId, customId: ticket.typeId });
      const { syncTicketChannel } = require('../utils/ticketNaming');
      try {
        await syncTicketChannel(interaction.channel, await Ticket.findById(ticket._id), type?.customId || 'ticket');
      } catch (err) {
        console.error('[ticket priority] channel rename failed:', err.message);
      }

      // Update welcome card with new priority color
      if (type && ticket.welcomeMessageId) {
        try {
          const welcomeMsg = await interaction.channel.messages.fetch(ticket.welcomeMessageId).catch(() => null);
          if (welcomeMsg) {
            await welcomeMsg.edit(ticketWelcomeCard(type, { id: ticket.userId, username: interaction.client.users.cache.get(ticket.userId)?.username || 'user' }, ticket.claimedBy, level, ticket.ticketNumber)).catch(() => {});
          }
        } catch {}
      }

      return interaction.editReply(successCard(`Priority set to **${level}**.`));
    }

    if (sub === 'close-request') {
      const reason = interaction.options.getString('reason') || null;
      if (ticket.closeRequestedAt) {
        return interaction.editReply(errorCard('A close request is already pending for this ticket.'));
      }
      await Ticket.findByIdAndUpdate(ticket._id, {
        closeRequestedAt: new Date(),
        closeRequestedBy: interaction.user.id,
        closeRequestReason: reason,
      });
      await audit(guildId, interaction.user.id, 'ticket_close_request', 'ticket', ticket._id.toString(), { reason });

      // Sync channel name (yellow emoji for close request)
      const type = await TicketType.findOne({ guildId, customId: ticket.typeId });
      const { syncTicketChannel } = require('../utils/ticketNaming');
      await syncTicketChannel(interaction.channel, await Ticket.findById(ticket._id), type?.customId || 'ticket').catch(() => {});

      // Notify ticket creator
      const creator = interaction.client.users.cache.get(ticket.userId);
      const reasonText = reason ? `\n**Reason:** ${reason}` : '';
      try {
        if (creator) {
          await creator.send(card({
            title: `${EMOJI.close} Staff Requests Ticket Close`,
            description: `A staff member would like to close this ticket (**<#${interaction.channelId}>**).${reasonText}\n\nYou have 24 hours to respond. Click **Keep Open** to extend, or **Close Ticket** to agree.`,
            color: COLORS.warning,
            buttons: [
              new ButtonBuilder().setCustomId(`ticket_keep_open:${ticket._id}`).setLabel('Keep Open').setStyle(ButtonStyle.Secondary),
              new ButtonBuilder().setCustomId(`ticket_agree_close:${ticket._id}`).setLabel('Close Ticket').setStyle(ButtonStyle.Danger),
            ],
            ephemeral: false,
          })).catch(() => {});
        }
      } catch {}

      return interaction.editReply(successCard(`Close request sent to <@${ticket.userId}>.`));
    }
  },
};

async function handleTicketEditModal(interaction) {
  const typeId      = interaction.customId.replace('ticket_edit:', '');
  const welcomeText = interaction.fields.getTextInputValue('welcome_text');
  const questions   = interaction.fields.getTextInputValue('questions').split('\n').map(q => q.trim()).filter(Boolean);
  const staffRoles  = interaction.fields.getTextInputValue('staff_roles').split(',').map(r => r.trim()).filter(Boolean);
  await TicketType.findOneAndUpdate({ guildId: interaction.guildId, customId: typeId }, { welcomeText, questions, staffRoles });
  return interaction.reply(successCard('Ticket type updated successfully.'));
}

async function handleTicketOpen(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const typeId = interaction.customId.replace('ticket_open:', '');
  const { guild, user } = interaction;

  const type = await TicketType.findOne({ guildId: guild.id, customId: typeId });
  if (!type) return interaction.editReply(errorCard('This ticket type is not configured. Ask an admin to run `/ticket setup`.'));

  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  // Blacklist check
  const blacklist = cfg?.ticketBlacklist || [];
  const blEntry = blacklist.find(b => b.userId === user.id);
  if (blEntry) return interaction.editReply(errorCard(`You are blacklisted from opening tickets. Reason: ${blEntry.reason}`));
  const maxOpen = cfg?.automation?.maxOpenTicketsPerUser ?? 3;

  // A9: Per-type limit + total limit
  const openCount = await Ticket.countDocuments({ guildId: guild.id, userId: user.id, status: 'open' });
  if (openCount >= maxOpen) {
    const existing = await Ticket.findOne({ guildId: guild.id, userId: user.id, status: 'open' });
    return interaction.editReply(errorCard(`You already have ${openCount} open ticket(s) (max ${maxOpen}). Please close existing tickets first.`));
  }
  const sameTypeCount = await Ticket.countDocuments({ guildId: guild.id, userId: user.id, typeId, status: 'open' });
  if (sameTypeCount >= 1) {
    const existing = await Ticket.findOne({ guildId: guild.id, userId: user.id, typeId, status: 'open' });
    return interaction.editReply(errorCard(`You already have an open ${type.name} ticket: <#${existing.channelId}>`));
  }

  // A4: Repair orphaned open records whose channel no longer exists
  const orphaned = await Ticket.find({ guildId: guild.id, userId: user.id, status: 'open' });
  for (const o of orphaned) {
    try {
      await guild.channels.fetch(o.channelId).catch(async () => {
        await Ticket.findByIdAndUpdate(o._id, { status: 'closed', closedBy: null });
      });
    } catch {}
  }

  const staffRoles = [...new Set([...(type.staffRoles || []), ...(cfg?.prStaffRoles || [])])];
  // A3: Bot itself needs access to the channel
  const botOverwrite = {
    id: interaction.client.user.id,
    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks],
  };
  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
    ...staffRoles.map(r => ({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] })),
    botOverwrite,
  ];

  // Assign ticket number first
  const cfgForNum = await GuildConfig.findOneAndUpdate(
    { guildId: guild.id },
    { $inc: { ticketCounter: 1 } },
    { upsert: true, new: true }
  );
  const ticketNumber = cfgForNum.ticketCounter;
  const numStr = String(ticketNumber).padStart(4, '0');

  const channelName = `${type.customId}-${numStr}`;
  let ticketChannel;
  try {
    ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: cfg?.ticketCategory || null,
      topic: `ticket:${user.id}:${typeId}`,
      permissionOverwrites,
    });
  } catch (err) {
    console.error('[ticket open] channel create failed:', err);
    return interaction.editReply(errorCard('Failed to create ticket channel. Check bot permissions.'));
  }

  // A1: Send ping and card as separate messages — V2 payload cannot have content
  const pingText = [`<@${user.id}>`, ...staffRoles.map(r => `<@&${r}>`)].join(' ');
  try {
    await ticketChannel.send({ content: pingText, allowedMentions: { users: [user.id], roles: staffRoles } });
    const welcomeMsg = await ticketChannel.send(ticketWelcomeCard(type, user, null, 'normal', ticketNumber));

    const ticketDoc = await Ticket.create({
      guildId: guild.id,
      channelId: ticketChannel.id,
      userId: user.id,
      typeId,
      ticketNumber,
      baseName: `${typeId}`,
      lastActivityAt: new Date(),
      welcomeMessageId: welcomeMsg.id,
    });

    await audit(guild.id, user.id, 'ticket_open', 'ticket', ticketDoc._id.toString(), { typeId, channelId: ticketChannel.id });

    return interaction.editReply(successCard(`Your ticket has been created: <#${ticketChannel.id}>`));
  } catch (err) {
    await ticketChannel.delete().catch(() => {});
    return interaction.editReply(errorCard('Failed to send ticket welcome message. The channel has been removed.'));
  }
}

async function handleTicketCloseRequest(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const { guild, channel, member } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });

  const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });
  if (!ticket) return interaction.editReply(errorCard('Ticket not found or already closed.'));

  // Only staff can request close
  if (!isStaff(member, cfg)) {
    return interaction.editReply(errorCard('Only staff can request a ticket close.'));
  }

  // Check if close request already exists
  if (ticket.closeRequestedAt) {
    return interaction.editReply(errorCard('A close request is already pending for this ticket.'));
  }

  const reason = interaction.options?.getString('reason') || null;
  const closeRequestHours = cfg?.automation?.ticketCloseRequestHours ?? 24;
  const closeAt = new Date(Date.now() + closeRequestHours * 60 * 60 * 1000);

  // Update ticket
  const updated = await Ticket.findByIdAndUpdate(ticket._id, {
    closeRequestedAt: new Date(),
    closeRequestedBy: interaction.user.id,
    closeRequestReason: reason,
  }, { new: true });

  // Send close request card in channel
  const cardPayload = card({
    title: '🔒 Close Request',
    description: getText(cfg, 'ticket_close_request', { staff: `<@${interaction.user.id}>`, user: `<@${ticket.userId}>`, ticket: ticket._id, reason: reason || '' }) + `\n\n**Requested by:** <@${interaction.user.id}>${reason ? `\n**Reason:** ${reason}` : ''}\n\nWill be auto-closed <t:${Math.floor(closeAt.getTime() / 1000)}:R> if no response.`,
    color: COLORS.warning,
    buttons: [
      new ButtonBuilder().setCustomId(`ticket_agree_close:${ticket._id}`).setLabel('Close').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_keep_open:${ticket._id}`).setLabel('Keep Open').setStyle(ButtonStyle.Secondary),
    ],
    ephemeral: false,
  });

  const msg = await channel.send(cardPayload, { allowedMentions: { users: [ticket.userId] } }).catch(() => null);
  if (msg) await Ticket.findByIdAndUpdate(ticket._id, { closeRequestMessageId: msg.id });

  // Ping opener
  await channel.send({ content: `<@${ticket.userId}>`, allowedMentions: { users: [ticket.userId] } }).catch(() => {});

  await audit(guild.id, interaction.user.id, 'ticket_close_request', 'ticket', ticket._id.toString(), { reason });

  await interaction.editReply(successCard('Close request sent in the ticket channel.'));
}

async function handleTicketClose(interaction) {
  const { guild, channel, member } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });

  const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });

  // Allow ticket creator or staff to close
  const isCreator = ticket?.userId === interaction.user.id;
  if (!isStaff(member, cfg) && !isCreator) {
    return interaction.reply({ ...errorCard('Only the ticket creator or staff can close this ticket.'), ephemeral: true });
  }

  // Staff close → modal with reason/category/duration
  if (isStaff(member, cfg)) {
    const modal = new ModalBuilder().setCustomId(`ticket_staff_close:${channel.id}`).setTitle('Close Ticket');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('category').setLabel('Category (optional)').setStyle(TextInputStyle.Short).setRequired(false)
      ),
    );
    return interaction.showModal(modal);
  }

  // A2: Confirmation card first (for non-staff)
  await interaction.deferReply({ ephemeral: true });
  return interaction.editReply(card({
    title: `${EMOJI.close} Confirm Ticket Close`,
    description: `Are you sure you want to close this ticket? The channel will be deleted shortly and a transcript will be sent to the log channel and ticket creator.`,
    color: COLORS.warning,
    buttons: [
      new ButtonBuilder().setCustomId(`ticket_confirm_close:${channel.id}`).setLabel('Yes, close').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('ticket_cancel_close').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
    ],
    ephemeral: true,
  }));
}


async function handleTicketStaffClose(interaction) {
  const channelId = interaction.customId.replace('ticket_staff_close:', '');
  const reason = interaction.fields.getTextInputValue('reason');
  const category = interaction.fields.getTextInputValue('category') || null;
  const { guild, channel, member } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });

  const ticket = await Ticket.findOne({ guildId: guild.id, channelId, status: 'open' });
  if (!ticket) return interaction.reply(errorCard('Ticket not found or already closed.'));

  await interaction.deferReply({ ephemeral: true });
  const result = await require('../services/ticketService').closeTicket(interaction.client, ticket._id.toString(), {
    closedBy: interaction.user.id,
    reason,
    source: 'staff_modal',
    category,
  });

  if (!result) return interaction.editReply(errorCard('Ticket already being closed.'));
  await interaction.editReply(successCard(`Ticket closed. Reason: ${reason}`));
}

async function handleTicketConfirmClose(interaction) {
  const channelId = interaction.customId.split(':')[1];
  const { guild, channel, member } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });

  const ticket = await Ticket.findOne({ guildId: guild.id, channelId, status: 'open' });
  if (!ticket) return interaction.update(errorCard('Ticket already being closed or not found.'));

  const isStaffMember = isStaff(member, cfg);
  const isCreator = ticket.userId === interaction.user.id;
  if (!isStaffMember && !isCreator) {
    return interaction.update(errorCard('Only the ticket creator or staff can close this ticket.'));
  }

  await interaction.deferUpdate();
  const result = await require('../services/ticketService').closeTicket(interaction.client, ticket._id.toString(), {
    closedBy: interaction.user.id,
    reason: ticket.closeRequestReason || null,
    source: 'manual',
  });

  if (!result) return interaction.followUp(errorCard('Ticket already being closed.')).catch(() => {});
  await interaction.followUp(successCard(`Ticket closed. Deleting channel shortly.`)).catch(() => {});
}

async function handleTicketCancelClose(interaction) {
  return interaction.update(successCard('Close cancelled.'));
}

async function handleTicketKeepOpen(interaction) {
  const ticketId = interaction.customId.split(':')[1];
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return interaction.update(errorCard('Ticket not found.'));
  const cfg = await GuildConfig.findOne({ guildId: ticket.guildId });
  if (interaction.user.id !== ticket.userId && !isStaff(interaction.member, cfg)) {
    return interaction.reply({ ...errorCard('Only the ticket creator or staff can keep this ticket open.'), ephemeral: true });
  }
  await Ticket.findByIdAndUpdate(ticketId, {
    closeRequestedAt: null,
    closeRequestedBy: null,
    closeRequestReason: null,
    lastActivityAt: new Date(),
  });
  await audit(ticket.guildId, interaction.user.id, 'ticket_keep_open', 'ticket', ticketId);
  return interaction.update(successCard('Ticket will remain open.'));
}

async function handleTicketAgreeClose(interaction) {
  const ticketId = interaction.customId.split(':')[1];
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return interaction.update(errorCard('Ticket not found.'));
  const cfg = await GuildConfig.findOne({ guildId: ticket.guildId });
  if (interaction.user.id !== ticket.userId && !isStaff(interaction.member, cfg)) {
    return interaction.reply({ ...errorCard('Only the ticket creator or staff can agree to close.'), ephemeral: true });
  }

  await interaction.deferUpdate();
  const result = await require('../services/ticketService').closeTicket(interaction.client, ticketId, {
    closedBy: interaction.user.id,
    reason: ticket.closeRequestReason || null,
    source: 'close_request',
  });

  if (!result) return interaction.followUp(errorCard('Ticket already being closed.')).catch(() => {});
  await interaction.followUp(successCard(`Ticket closed. Deleting channel shortly.`)).catch(() => {});
}

async function handleTicketClaim(interaction) {
  await interaction.deferUpdate();
  const { member, channel, guild } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  if (!isStaff(member, cfg)) {
    return interaction.followUp(errorCard('Only staff can claim tickets.'));
  }

  // A1: Prevent double-claim — claimedBy must be null
  const fetchedMember = await guild.members.fetch(interaction.user.id).catch(() => null);
  const claimedByName = fetchedMember?.displayName || interaction.user.username;
  const ticket = await Ticket.findOneAndUpdate(
    { guildId: guild.id, channelId: channel.id, status: 'open', claimedBy: null },
    { claimedBy: interaction.user.id, claimedByName },
    { new: true }
  );
  if (!ticket) {
    const existing = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });
    if (existing && existing.claimedBy) {
      return interaction.followUp(errorCard(`Already claimed by <@${existing.claimedBy}>.`));
    }
    return interaction.followUp(errorCard('Ticket not found.'));
  }

  const type = await TicketType.findOne({ guildId: guild.id, customId: ticket.typeId });
  if (!type) return interaction.followUp(errorCard('Ticket type not found.'));

  // A1: Update welcome card + send feedback to channel
  await interaction.editReply(ticketWelcomeCard(type, { id: ticket.userId }, interaction.user.id, ticket.priority, ticket.ticketNumber));

  if (ticket.welcomeMessageId) {
    try {
      const welcomeMsg = await channel.messages.fetch(ticket.welcomeMessageId).catch(() => null);
      if (welcomeMsg) {
        await welcomeMsg.edit(ticketWelcomeCard(type, { id: ticket.userId }, interaction.user.id, ticket.priority, ticket.ticketNumber)).catch(() => {});
      }
    } catch {}
  }

  try {
    await channel.send({ ...card({
      title: `${EMOJI.claim} Ticket Claimed`,
      description: getText(cfg, 'ticket_claim', { staff: `<@${interaction.user.id}>`, user: `<@${ticket.userId}>`, ticket: ticket._id }) + `\nPing: <@${ticket.userId}>`,
      color: COLORS.primary,
      buttons: [],
      ephemeral: false,
    }), allowedMentions: { users: [ticket.userId] } }).catch(() => {});
  } catch {}

  await audit(guild.id, interaction.user.id, 'ticket_claim', 'ticket', ticket._id.toString());

  // Sync channel name
  const { syncTicketChannel } = require('../utils/ticketNaming');
  await syncTicketChannel(channel, ticket, type?.customId || 'ticket').catch(() => {});
}

async function handleTicketRelease(interaction) {
  await interaction.deferUpdate();
  const { member, channel, guild } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  if (!isStaff(member, cfg)) {
    return interaction.followUp(errorCard('Only staff can release tickets.'));
  }

  // A1: Staff with Manage Guild can release any claim
  const isManageGuild = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);
  const filter = isManageGuild
    ? { guildId: guild.id, channelId: channel.id, status: 'open', claimedBy: { $ne: null } }
    : { guildId: guild.id, channelId: channel.id, status: 'open', claimedBy: interaction.user.id };

  const ticket = await Ticket.findOneAndUpdate(filter, { claimedBy: null }, { new: true });
  if (!ticket) {
    const existing = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });
    if (!existing) return interaction.followUp(errorCard('Ticket not found.'));
    if (!existing.claimedBy) return interaction.followUp(errorCard('This ticket is not claimed.'));
    return interaction.followUp(errorCard('You have not claimed this ticket.'));
  }

  const type = await TicketType.findOne({ guildId: guild.id, customId: ticket.typeId });
  if (!type) return interaction.followUp(errorCard('Ticket type not found.'));

  await interaction.editReply(ticketWelcomeCard(type, { id: ticket.userId }, null, ticket.priority, ticket.ticketNumber));

  if (ticket.welcomeMessageId) {
    try {
      const welcomeMsg = await channel.messages.fetch(ticket.welcomeMessageId).catch(() => null);
      if (welcomeMsg) {
        await welcomeMsg.edit(ticketWelcomeCard(type, { id: ticket.userId }, null, ticket.priority, ticket.ticketNumber)).catch(() => {});
      }
    } catch {}
  }

  try {
    await channel.send({ ...card({
      title: `${EMOJI.release} Ticket Unassigned`,
      description: `This ticket is unassigned again. A staff member will pick it up shortly.\nPing: <@${ticket.userId}>`,
      color: COLORS.primary,
      buttons: [],
      ephemeral: false,
    }), allowedMentions: { users: [ticket.userId] } }).catch(() => {});
  } catch {}

  await audit(guild.id, interaction.user.id, 'ticket_release', 'ticket', ticket._id.toString());

  // Sync channel name
  const type2 = await TicketType.findOne({ guildId: guild.id, customId: ticket.typeId });
  const { syncTicketChannel } = require('../utils/ticketNaming');
  await syncTicketChannel(channel, ticket, type2?.customId || 'ticket').catch(() => {});
}

async function handleTicketRate(interaction) {
  const parts = interaction.customId.split(':'); // ticket_rate:ID:STARS
  const ticketId = parts[1];
  const stars    = parseInt(parts[2], 10);

  const ticket = await Ticket.findById(ticketId);
  if (!ticket) return interaction.update(errorCard('Ticket not found.'));
  if (ticket.ratingSentAt) return interaction.update(errorCard('You have already rated this ticket.'));

  await Ticket.findByIdAndUpdate(ticketId, { rating: stars, ratingSentAt: new Date() });

  // Ask for optional feedback
  const modal = new ModalBuilder().setCustomId(`ticket_rate_feedback:${ticketId}:${stars}`).setTitle('Optional Feedback');
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder().setCustomId('feedback').setLabel('Any additional feedback? (optional)').setStyle(TextInputStyle.Paragraph).setRequired(false)
  ));
  return interaction.showModal(modal);
}

async function handleTicketRateFeedbackModal(interaction) {
  const parts    = interaction.customId.split(':');
  const ticketId = parts[1];
  const stars    = parseInt(parts[2], 10);
  const feedback = interaction.fields.getTextInputValue('feedback') || null;

  const ticket = await Ticket.findByIdAndUpdate(ticketId, { ratingFeedback: feedback }, { new: true });

  if (ticket) {
    const GuildConfig = require('../models/GuildConfig');
    const cfg = await GuildConfig.findOne({ guildId: ticket.guildId });
    if (cfg?.logChannel) {
      const logCh = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
      if (logCh) {
        await logCh.send(logCard(
          `${EMOJI.star} Ticket Rated`,
          `Ticket #${String(ticket.ticketNumber || 0).padStart(4, '0')} rated **${'⭐'.repeat(stars)}** by <@${interaction.user.id}>${feedback ? `\n> ${feedback}` : ''}`
        )).catch(() => {});
      }
    }
  }

  return interaction.reply(successCard(`Thank you for your feedback! You rated this ticket **${'⭐'.repeat(stars)}**`.replace('ephemeral', '')));
}

module.exports.handleTicketClose            = handleTicketClose;
module.exports.handleTicketStaffClose        = handleTicketStaffClose;
module.exports.handleTicketCloseRequest      = handleTicketCloseRequest;
module.exports.handleTicketConfirmClose     = handleTicketConfirmClose;
module.exports.handleTicketCancelClose      = handleTicketCancelClose;
module.exports.handleTicketKeepOpen         = handleTicketKeepOpen;
module.exports.handleTicketAgreeClose       = handleTicketAgreeClose;
module.exports.handleTicketClaim            = handleTicketClaim;
module.exports.handleTicketRelease          = handleTicketRelease;
module.exports.handleTicketRate             = handleTicketRate;
module.exports.handleTicketRateFeedbackModal = handleTicketRateFeedbackModal;
module.exports.handleTicketEditModal        = handleTicketEditModal;
module.exports.handleTicketOpen             = handleTicketOpen;
module.exports.handleTicketClose            = handleTicketClose;
module.exports.handleTicketStaffClose        = handleTicketStaffClose;
module.exports.handleTicketConfirmClose     = handleTicketConfirmClose;
module.exports.handleTicketCancelClose      = handleTicketCancelClose;
module.exports.handleTicketKeepOpen         = handleTicketKeepOpen;
module.exports.handleTicketAgreeClose       = handleTicketAgreeClose;
module.exports.handleTicketClaim            = handleTicketClaim;
module.exports.handleTicketRelease          = handleTicketRelease;
module.exports.handleTicketRate             = handleTicketRate;
module.exports.handleTicketRateFeedbackModal = handleTicketRateFeedbackModal;
module.exports.handleTicketEditModal        = handleTicketEditModal;
