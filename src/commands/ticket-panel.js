const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionsBitField,
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

const PARTNERSHIP_QUESTIONS = `
## 📋 Partnership Application
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please answer the following questions:

**1.** What is the name of your Roblox group/community?
**2.** What is your Roblox group link?
**3.** What is your Discord server invite link?
**4.** How many members does your group have?
**5.** Why do you want to partner with Roastin Coffee?
**6.** What can you offer as a partner?

> *A PR staff member will review your application shortly.*
`;

const INQUIRY_QUESTIONS = `
## 💬 General PR Inquiry
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Please describe your inquiry below:

**1.** What is your question or concern?
**2.** Is this related to an existing partnership? If so, which one?
**3.** How can we best assist you?

> *A PR staff member will be with you shortly.*
`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Post the partnership ticket panel in this channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(0x6F4E37)
      .setTitle('☕ Roastin Coffee — PR Department')
      .setDescription(
        `## Welcome to the PR Ticket System\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `> *Select an option below to open a private support ticket.*\n\n` +
        `### 🤝 Apply for Partnership\n` +
        `Want to partner with Roastin Coffee? Click the button below to start your application.\n\n` +
        `### 💬 General PR Inquiry\n` +
        `Have a question or concern for our PR team? We're here to help.`
      )
      .setFooter({ text: 'Roastin Coffee PR System' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('ticket_apply')
        .setLabel('🤝 Apply for Partnership')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('ticket_inquiry')
        .setLabel('💬 General PR Inquiry')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ content: '✅ Ticket panel posted.', ephemeral: true });
    await interaction.channel.send({ embeds: [embed], components: [row] });
  },
};

async function handleTicketOpen(interaction) {
  const { guild, user } = interaction;
  const isApply = interaction.customId === 'ticket_apply';
  const cfg = await GuildConfig.findOne({ guildId: guild.id });

  const channelName = `${isApply ? 'apply' : 'inquiry'}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

  // Check if ticket already exists
  const existing = guild.channels.cache.find(c => c.name === channelName);
  if (existing) {
    return interaction.reply({ content: `❌ You already have an open ticket: <#${existing.id}>`, ephemeral: true });
  }

  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
  ];

  if (cfg?.prStaffRole) {
    permissionOverwrites.push({
      id: cfg.prStaffRole,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
    });
  }

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: cfg?.ticketCategory || null,
    permissionOverwrites,
  });

  const embed = new EmbedBuilder()
    .setColor(0x6F4E37)
    .setTitle(isApply ? '🤝 Partnership Application' : '💬 General PR Inquiry')
    .setDescription(
      `Welcome, <@${user.id}>!\n\n` +
      (isApply ? PARTNERSHIP_QUESTIONS : INQUIRY_QUESTIONS)
    )
    .setFooter({ text: 'Roastin Coffee PR System' })
    .setTimestamp();

  await ticketChannel.send({ content: `<@${user.id}>${cfg?.prStaffRole ? ` <@&${cfg.prStaffRole}>` : ''}`, embeds: [embed] });

  return interaction.reply({ content: `✅ Your ticket has been created: <#${ticketChannel.id}>`, ephemeral: true });
}

module.exports.handleTicketOpen = handleTicketOpen;
