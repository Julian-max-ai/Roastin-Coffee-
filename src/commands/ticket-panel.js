const {
  SlashCommandBuilder, PermissionFlagsBits,
  ChannelType, PermissionsBitField,
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const TicketType = require('../models/TicketType');

// Fixed ticket types — customIds match dweeb button customIds
const DEFAULT_TYPES = [
  {
    customId: 'general',
    name: 'General Question',
    emoji: '💬',
    questions: [
      'What is your question?',
      'Is this related to an existing partnership?',
      'How can we best assist you?',
    ],
    welcomeText: 'Thank you for reaching out! A PR staff member will be with you shortly.',
  },
  {
    customId: 'partnership',
    name: 'Partnership Request',
    emoji: '🤝',
    questions: [
      'What is the name of your Roblox group/community?',
      'What is your Roblox group link?',
      'What is your Discord server invite link?',
      'How many members does your group have?',
      'Why do you want to partner with Roastin Coffee?',
      'What can you offer as a partner?',
    ],
    welcomeText: 'Thank you for your partnership interest! Please answer the questions below and a PR staff member will review your application.',
  },
  {
    customId: 'report',
    name: 'Public Relations Report',
    emoji: '📋',
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
    .addSubcommand(sub => sub
      .setName('setup')
      .setDescription('Initialize the 3 default ticket types for this server.'))
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('Edit a ticket type.')
      .addStringOption(o => o.setName('type').setDescription('Ticket type').setRequired(true)
        .addChoices(
          { name: '💬 General Question', value: 'general' },
          { name: '🤝 Partnership Request', value: 'partnership' },
          { name: '📋 PR Report', value: 'report' },
        )))
    .addSubcommand(sub => sub
      .setName('info')
      .setDescription('View current ticket type configuration.')),

  async execute(interaction) {
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      for (const t of DEFAULT_TYPES) {
        await TicketType.findOneAndUpdate(
          { guildId, customId: t.customId },
          { ...t, guildId },
          { upsert: true, new: true }
        );
      }
      return interaction.reply({
        content:
          `## ✅ Ticket System Ready\n` +
          `-# Roastin Coffee Ticket System\n\n` +
          `**3 ticket types configured:**\n\n` +
          `> 💬 **General Question** → Button customId: \`ticket_open:general\`\n` +
          `> 🤝 **Partnership Request** → Button customId: \`ticket_open:partnership\`\n` +
          `> 📋 **PR Report** → Button customId: \`ticket_open:report\`\n\n` +
          `**In dweeb.faizo.net:**\n` +
          `> Add buttons with these exact customIds to your ticket panel design.\n\n` +
          `-# Use \`/ticket edit\` to customize questions and welcome texts.`,
        ephemeral: true,
      });
    }

    if (sub === 'info') {
      const types = await TicketType.find({ guildId });
      if (!types.length) return interaction.reply({ content: '❌ No ticket types found. Run `/ticket setup` first.', ephemeral: true });

      let msg = `## 🎫 Ticket Types\n-# ${types.length} type(s) configured\n\n`;
      for (const t of types) {
        msg += `**${t.emoji} ${t.name}** (\`ticket_open:${t.customId}\`)\n`;
        msg += `> ${t.welcomeText}\n`;
        msg += `> **Questions:** ${t.questions.length}\n`;
        msg += `> **Staff Roles:** ${t.staffRoles.length ? t.staffRoles.map(r => `<@&${r}>`).join(', ') : '*None set*'}\n\n`;
      }
      return interaction.reply({ content: msg, ephemeral: true });
    }

    if (sub === 'edit') {
      const typeId = interaction.options.getString('type');
      const type = await TicketType.findOne({ guildId, customId: typeId });
      if (!type) return interaction.reply({ content: '❌ Run `/ticket setup` first.', ephemeral: true });

      const modal = new ModalBuilder()
        .setCustomId(`ticket_edit:${typeId}`)
        .setTitle(`Edit ${type.name}`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('welcome_text').setLabel('Welcome Text')
            .setStyle(TextInputStyle.Paragraph).setValue(type.welcomeText).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('questions').setLabel('Questions (one per line)')
            .setStyle(TextInputStyle.Paragraph).setValue(type.questions.join('\n')).setRequired(true)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('staff_roles').setLabel('Staff Role IDs (comma separated)')
            .setStyle(TextInputStyle.Short).setValue(type.staffRoles.join(', ')).setRequired(false)
        ),
      );

      return interaction.showModal(modal);
    }
  },
};

async function handleTicketEditModal(interaction) {
  const typeId = interaction.customId.replace('ticket_edit:', '');
  const { guildId } = interaction;

  const welcomeText = interaction.fields.getTextInputValue('welcome_text');
  const questions = interaction.fields.getTextInputValue('questions').split('\n').map(q => q.trim()).filter(Boolean);
  const staffRolesRaw = interaction.fields.getTextInputValue('staff_roles');
  const staffRoles = staffRolesRaw ? staffRolesRaw.split(',').map(r => r.trim()).filter(Boolean) : [];

  await TicketType.findOneAndUpdate({ guildId, customId: typeId }, { welcomeText, questions, staffRoles });

  return interaction.reply({ content: `✅ Ticket type updated successfully.`, ephemeral: true });
}

async function handleTicketOpen(interaction) {
  const typeId = interaction.customId.replace('ticket_open:', '');
  const { guild, user } = interaction;

  const type = await TicketType.findOne({ guildId: guild.id, customId: typeId });
  if (!type) return interaction.reply({ content: '❌ This ticket type is not configured. Ask an admin to run `/ticket setup`.', ephemeral: true });

  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  const channelName = `${type.customId}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;

  const existing = guild.channels.cache.find(c => c.name === channelName);
  if (existing) return interaction.reply({ content: `❌ You already have an open ticket: <#${existing.id}>`, ephemeral: true });

  const staffRoles = [...new Set([...(type.staffRoles || []), ...(cfg?.prStaffRoles || [])])];

  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
    ...staffRoles.map(r => ({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] })),
  ];

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: cfg?.ticketCategory || null,
    permissionOverwrites,
  });

  const pingText = [`<@${user.id}>`, ...staffRoles.map(r => `<@&${r}>`)].join(' ');

  let msg =
    `## ${type.emoji} ${type.name}\n` +
    `-# Roastin Coffee Ticket System\n\n` +
    `${type.welcomeText}\n\n` +
    `### 📋 Please answer the following:\n`;

  type.questions.forEach((q, i) => { msg += `\n**${i + 1}.** ${q}`; });

  await ticketChannel.send({ content: pingText });
  await ticketChannel.send({ content: msg });

  return interaction.reply({ content: `✅ Your ticket has been created: <#${ticketChannel.id}>`, ephemeral: true });
}

module.exports.handleTicketOpen = handleTicketOpen;
module.exports.handleTicketEditModal = handleTicketEditModal;
