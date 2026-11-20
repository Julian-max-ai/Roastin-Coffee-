'use strict';
const {
  SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, PermissionsBitField,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const GuildConfig  = require('../models/GuildConfig');
const TicketType   = require('../models/TicketType');
const { ticketWelcomeCard, errorCard, successCard, logCard } = require('../ui');
const { isStaff } = require('../utils/permissions');
const { EMOJI, TICKET_CLOSE_DELAY_MS } = require('../theme');

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
    .addSubcommand(s => s.setName('info').setDescription('View current ticket type configuration.')),

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
      return interaction.reply({ ...require('../ui').infoCard(`${EMOJI.ticket} Ticket Types`, desc, true) });
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
  const typeId = interaction.customId.replace('ticket_open:', '');
  const { guild, user } = interaction;

  const type = await TicketType.findOne({ guildId: guild.id, customId: typeId });
  if (!type) return interaction.reply(errorCard('This ticket type is not configured. Ask an admin to run `/ticket setup`.'));

  const cfg = await GuildConfig.findOne({ guildId: guild.id });

  // Duplicate check via channel topic
  const topic    = `ticket:${user.id}:${typeId}`;
  const existing = guild.channels.cache.find(c => c.topic === topic);
  if (existing) return interaction.reply(errorCard(`You already have an open ticket: <#${existing.id}>`));

  const staffRoles = [...new Set([...(type.staffRoles || []), ...(cfg?.prStaffRoles || [])])];
  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
    ...staffRoles.map(r => ({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] })),
  ];

  const channelName = `${type.customId}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;
  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: cfg?.ticketCategory || null,
    topic,
    permissionOverwrites,
  });

  const pingText = [`<@${user.id}>`, ...staffRoles.map(r => `<@&${r}>`)].join(' ');
  await ticketChannel.send({ content: pingText, ...ticketWelcomeCard(type, user) });

  return interaction.reply(successCard(`Your ticket has been created: <#${ticketChannel.id}>`));
}

async function handleTicketClose(interaction) {
  const { guild, channel, member } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: guild.id });

  if (!isStaff(member, cfg) && !channel.topic?.startsWith(`ticket:${interaction.user.id}:`)) {
    return interaction.reply(errorCard('Only the ticket creator or staff can close this ticket.'));
  }

  await interaction.reply(successCard('Ticket closing in 5 seconds. Generating transcript...'));

  // Build transcript
  const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
  let transcript = `Ticket Transcript — ${channel.name}\n`;
  transcript += `Closed by: ${interaction.user.tag} at ${new Date().toISOString()}\n`;
  transcript += '─'.repeat(50) + '\n';
  if (messages) {
    for (const msg of [...messages.values()].reverse()) {
      transcript += `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content || '[no text content]'}\n`;
      if (msg.attachments.size) transcript += `  Attachments: ${msg.attachments.map(a => a.url).join(', ')}\n`;
    }
  }

  const buffer = Buffer.from(transcript, 'utf-8');
  const file   = { attachment: buffer, name: `transcript-${channel.name}.txt` };

  // Send to log channel
  if (cfg?.logChannel) {
    const logCh = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
    if (logCh) await logCh.send({ ...logCard(`${EMOJI.ticket} Ticket Closed — ${channel.name}`, `Closed by <@${interaction.user.id}>`), files: [file] }).catch(() => {});
  }

  // DM transcript to opener
  const topicParts = channel.topic?.split(':');
  if (topicParts?.length >= 2) {
    try {
      const opener = await interaction.client.users.fetch(topicParts[1]);
      await opener.send({ ...successCard('Your ticket has been closed. Here is your transcript:', false), files: [file] });
    } catch {}
  }

  setTimeout(() => channel.delete().catch(() => {}), TICKET_CLOSE_DELAY_MS);
}

async function handleTicketClaim(interaction) {
  const { member, channel } = interaction;
  const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
  if (!isStaff(member, cfg)) return interaction.reply(errorCard('Only staff can claim tickets.'));

  // Update the welcome card message to show claimed by
  const topicParts = channel.topic?.split(':');
  const typeId     = topicParts?.[2];
  const type       = typeId ? await TicketType.findOne({ guildId: interaction.guildId, customId: typeId }) : null;

  if (type) {
    await interaction.update({ ...ticketWelcomeCard(type, { id: topicParts[1] }, interaction.user.id), components: [] });
  } else {
    await interaction.reply(successCard(`Ticket claimed by <@${interaction.user.id}>.`));
  }
}

module.exports.handleTicketOpen      = handleTicketOpen;
module.exports.handleTicketClose     = handleTicketClose;
module.exports.handleTicketClaim     = handleTicketClaim;
module.exports.handleTicketEditModal = handleTicketEditModal;
