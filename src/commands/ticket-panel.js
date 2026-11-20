'use strict';
const {
  SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, PermissionsBitField,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const GuildConfig  = require('../models/GuildConfig');
const TicketType   = require('../models/TicketType');
const Ticket       = require('../models/Ticket');
const { ticketWelcomeCard, ticketRatingCard, errorCard, successCard, logCard, infoCard } = require('../ui');
const { isStaff } = require('../utils/permissions');
const { EMOJI, TICKET_CLOSE_DELAY_MS } = require('../theme');
const { audit } = require('../utils/audit');

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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('setup').setDescription('Initialize the 3 default ticket types.'))
    .addSubcommand(s => s.setName('edit').setDescription('Edit a ticket type.')
      .addStringOption(o => o.setName('type').setDescription('Ticket type').setRequired(true)
        .addChoices(
          { name: '💬 General Question', value: 'general' },
          { name: '🤝 Partnership Request', value: 'partnership' },
          { name: '📋 PR Report', value: 'report' },
        )))
    .addSubcommand(s => s.setName('info').setDescription('View current ticket type configuration.'))
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
        ))),

  async execute(interaction) {
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      for (const t of DEFAULT_TYPES) {
        await TicketType.findOneAndUpdate({ guildId, customId: t.customId }, { ...t, guildId }, { upsert: true });
      }
      return interaction.reply(successCard(
        `**3 ticket types initialized.**\n\n` +
        `In dweeb.faizo.net, set button customIds to:\n` +
        `> \`ticket_open:general\`\n` +
        `> \`ticket_open:partnership\`\n` +
        `> \`ticket_open:report\`\n\n` +
        `Use \`/ticket edit\` to customize questions and welcome texts.`
      ));
    }

    if (sub === 'info') {
      const types = await TicketType.find({ guildId });
      if (!types.length) return interaction.reply(errorCard('No ticket types found. Run `/ticket setup` first.'));
      let desc = '';
      for (const t of types) {
        desc += `**${t.emoji} ${t.name}** (\`ticket_open:${t.customId}\`)\n`;
        desc += `> ${t.welcomeText}\n`;
        desc += `> **Questions:** ${t.questions.length} · **Staff Roles:** ${t.staffRoles.length ? t.staffRoles.map(r => `<@&${r}>`).join(', ') : '*None*'}\n\n`;
      }
      return interaction.reply(infoCard(`${EMOJI.ticket} Ticket Types`, desc, true));
    }

    if (sub === 'edit') {
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

    // ── Ticket-channel-only subcommands ──────────────────────────────────────
    await interaction.deferReply({ ephemeral: true });
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) {
      return interaction.editReply(errorCard('Only staff can use this command.'));
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
      const name = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 50);
      await interaction.channel.setName(name).catch(() => {});
      return interaction.editReply(successCard(`Channel renamed to **${name}**.`));
    }

    if (sub === 'priority') {
      const level = interaction.options.getString('level');
      await Ticket.findByIdAndUpdate(ticket._id, { priority: level });
      const type = await TicketType.findOne({ guildId, customId: ticket.typeId });
      if (type) {
        const baseName = interaction.channel.name.replace(/^[🔵⚪🟡🔴]-/, '');
        const { PRIORITY_EMOJI } = require('../theme');
        await interaction.channel.setName(`${PRIORITY_EMOJI[level]}-${baseName}`.slice(0, 100)).catch(() => {});
      }
      return interaction.editReply(successCard(`Priority set to **${level}**.`));
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
  const maxOpen = cfg?.automation?.maxOpenTicketsPerUser ?? 3;

  // A4: DB-based duplicate check (reliable even with incomplete cache)
  const openCount = await Ticket.countDocuments({ guildId: guild.id, userId: user.id, status: 'open' });
  if (openCount >= maxOpen) {
    const existing = await Ticket.findOne({ guildId: guild.id, userId: user.id, status: 'open' });
    return interaction.editReply(errorCard(`You already have ${openCount} open ticket(s) (max ${maxOpen}). Please close existing tickets first.`));
  }

  const staffRoles = [...new Set([...(type.staffRoles || []), ...(cfg?.prStaffRoles || [])])];
  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
    ...staffRoles.map(r => ({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] })),
  ];

  const channelName = `${type.customId}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;
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
    await ticketChannel.send(ticketWelcomeCard(type, user));
  } catch (err) {
    // A1: Clean up orphaned channel on failure
    await ticketChannel.delete().catch(() => {});
    return interaction.editReply(errorCard('Failed to send ticket welcome message. The channel has been removed.'));
  }

  // Save to DB
  const ticket = await Ticket.create({
    guildId: guild.id,
    channelId: ticketChannel.id,
    userId: user.id,
    typeId,
    lastActivityAt: new Date(),
  });

  await audit(guild.id, user.id, 'ticket_open', 'ticket', ticket._id.toString(), { typeId, channelId: ticketChannel.id });

  return interaction.editReply(successCard(`Your ticket has been created: <#${ticketChannel.id}>`));
}

async function handleTicketClose(interaction) {
  await interaction.deferReply({ ephemeral: false });
  const { guild, channel, member } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });

  const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });

  // Allow ticket creator or staff to close
  const isCreator = ticket?.userId === interaction.user.id;
  if (!isStaff(member, cfg) && !isCreator) {
    return interaction.editReply(errorCard('Only the ticket creator or staff can close this ticket.'));
  }

  // Build transcript
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  let transcript = `Ticket Transcript — ${channel.name}\n`;
  transcript += `Closed by: ${interaction.user.tag} at ${new Date().toISOString()}\n`;
  transcript += '─'.repeat(50) + '\n';

  let htmlRows = '';
  if (messages) {
    for (const msg of [...messages.values()].reverse()) {
      transcript += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content || '[no text content]'}\n`;
      if (msg.attachments.size) transcript += `  Attachments: ${msg.attachments.map(a => a.url).join(', ')}\n`;
      const initials = msg.author.username.slice(0, 2).toUpperCase();
      const attachLinks = msg.attachments.size
        ? `<div class="attachments">${msg.attachments.map(a => `<a href="${a.url}" target="_blank">${a.name}</a>`).join(' ')}</div>`
        : '';
      htmlRows += `<div class="msg"><div class="avatar">${initials}</div><div class="body"><span class="author">${msg.author.tag}</span><span class="time">${msg.createdAt.toLocaleString()}</span><p>${msg.content ? msg.content.replace(/</g, '&lt;') : '<em>[no text]</em>'}</p>${attachLinks}</div></div>\n`;
    }
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Transcript — ${channel.name}</title>
<style>body{font-family:sans-serif;background:#1e1e1e;color:#ddd;padding:20px;max-width:800px;margin:auto}
.msg{display:flex;gap:12px;margin-bottom:16px}.avatar{width:40px;height:40px;border-radius:50%;background:#C68E4E;display:flex;align-items:center;justify-content:center;font-weight:bold;flex-shrink:0}
.body{flex:1}.author{font-weight:bold;color:#C68E4E}.time{font-size:.8em;color:#888;margin-left:8px}p{margin:4px 0}.attachments a{color:#7ab4f5;font-size:.85em;margin-right:8px}
h1{color:#C68E4E;border-bottom:1px solid #444;padding-bottom:8px}</style></head>
<body><h1>🎫 ${channel.name}</h1><p>Closed by <strong>${interaction.user.tag}</strong> at ${new Date().toLocaleString()}</p><hr>${htmlRows}</body></html>`;

  const txtFile  = { attachment: Buffer.from(transcript, 'utf-8'), name: `transcript-${channel.name}.txt` };
  const htmlFile = { attachment: Buffer.from(html, 'utf-8'), name: `transcript-${channel.name}.html` };

  // Send to log channel
  if (cfg?.logChannel) {
    const logCh = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
    if (logCh) {
      await logCh.send({
        ...logCard(`${EMOJI.ticket} Ticket Closed — ${channel.name}`, `Closed by <@${interaction.user.id}>`),
        files: [txtFile, htmlFile],
      }).catch(() => {});
    }
  }

  // DM transcript to opener
  if (ticket?.userId) {
    try {
      const opener = await interaction.client.users.fetch(ticket.userId);
      await opener.send({ ...successCard('Your ticket has been closed. Here is your transcript:', false), files: [txtFile, htmlFile] });
    } catch {}
  }

  // Update DB
  if (ticket) {
    await Ticket.findByIdAndUpdate(ticket._id, {
      status: 'closed',
      closedAt: new Date(),
      closedBy: interaction.user.id,
    });
    await audit(guild.id, interaction.user.id, 'ticket_close', 'ticket', ticket._id.toString(), { channelName: channel.name });

    // Send rating DM if enabled
    if (cfg?.automation?.ticketRatingEnabled !== false && ticket.userId) {
      try {
        const opener = await interaction.client.users.fetch(ticket.userId);
        await opener.send(ticketRatingCard(channel.name, ticket._id.toString()));
      } catch {}
    }
  }

  await interaction.editReply(successCard(`Ticket closing in ${TICKET_CLOSE_DELAY_MS / 1000} seconds.`));
  setTimeout(() => channel.delete().catch(() => {}), TICKET_CLOSE_DELAY_MS);
}

async function handleTicketClaim(interaction) {
  await interaction.deferUpdate();
  const { member, channel, guild } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  if (!isStaff(member, cfg)) {
    return interaction.followUp(errorCard('Only staff can claim tickets.'));
  }

  const ticket = await Ticket.findOneAndUpdate(
    { guildId: guild.id, channelId: channel.id, status: 'open' },
    { claimedBy: interaction.user.id },
    { new: true }
  );
  if (!ticket) return interaction.followUp(errorCard('Ticket not found.'));

  const type = await TicketType.findOne({ guildId: guild.id, customId: ticket.typeId });
  if (!type) return interaction.followUp(errorCard('Ticket type not found.'));

  // A2: Update the card — no components:[] override, just send the updated card
  await interaction.editReply(ticketWelcomeCard(type, { id: ticket.userId }, interaction.user.id, ticket.priority));
  await audit(guild.id, interaction.user.id, 'ticket_claim', 'ticket', ticket._id.toString());
}

async function handleTicketRelease(interaction) {
  await interaction.deferUpdate();
  const { member, channel, guild } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  if (!isStaff(member, cfg)) {
    return interaction.followUp(errorCard('Only staff can release tickets.'));
  }

  const ticket = await Ticket.findOneAndUpdate(
    { guildId: guild.id, channelId: channel.id, status: 'open', claimedBy: interaction.user.id },
    { claimedBy: null },
    { new: true }
  );
  if (!ticket) return interaction.followUp(errorCard('You have not claimed this ticket.'));

  const type = await TicketType.findOne({ guildId: guild.id, customId: ticket.typeId });
  if (!type) return interaction.followUp(errorCard('Ticket type not found.'));

  await interaction.editReply(ticketWelcomeCard(type, { id: ticket.userId }, null, ticket.priority));
}

async function handleTicketRate(interaction) {
  const parts = interaction.customId.split(':'); // ticket_rate:ID:STARS
  const ticketId = parts[1];
  const stars    = parseInt(parts[2], 10);

  await Ticket.findByIdAndUpdate(ticketId, { rating: stars });

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

  // Log rating
  if (ticket) {
    const GuildConfig = require('../models/GuildConfig');
    const cfg = await GuildConfig.findOne({ guildId: ticket.guildId });
    if (cfg?.logChannel) {
      const logCh = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
      if (logCh) {
        await logCh.send(logCard(
          `${EMOJI.star} Ticket Rated`,
          `Ticket \`${ticketId}\` rated **${'⭐'.repeat(stars)}** by <@${interaction.user.id}>${feedback ? `\n> ${feedback}` : ''}`
        )).catch(() => {});
      }
    }
  }

  return interaction.reply(successCard(`Thank you for your feedback! You rated this ticket **${'⭐'.repeat(stars)}**.`));
}

module.exports.handleTicketOpen             = handleTicketOpen;
module.exports.handleTicketClose            = handleTicketClose;
module.exports.handleTicketClaim            = handleTicketClaim;
module.exports.handleTicketRelease          = handleTicketRelease;
module.exports.handleTicketRate             = handleTicketRate;
module.exports.handleTicketRateFeedbackModal = handleTicketRateFeedbackModal;
module.exports.handleTicketEditModal        = handleTicketEditModal;
