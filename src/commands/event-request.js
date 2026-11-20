const {
  SlashCommandBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event-request')
    .setDescription('Submit an affiliate event or shift announcement for approval.')
    .addStringOption(o => o.setName('title').setDescription('Event title').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('Event description').setRequired(true))
    .addStringOption(o => o.setName('date').setDescription('Date & time (e.g. July 20, 2025 at 3PM UTC)').setRequired(true))
    .addStringOption(o => o.setName('type').setDescription('Type').setRequired(true)
      .addChoices({ name: 'Event', value: 'Event' }, { name: 'Shift', value: 'Shift' })),

  async execute(interaction) {
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
    if (!cfg?.announcementChannel) return interaction.reply({ content: '❌ No announcement channel configured.', ephemeral: true });

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const date = interaction.options.getString('date');
    const type = interaction.options.getString('type');

    const preview =
      `## 📝 Event Request — Pending Approval\n` +
      `-# Submitted by <@${interaction.user.id}>\n\n` +
      `**${type}: ${title}**\n` +
      `**Date:** ${date}\n\n` +
      `> ${description}`;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`event_approve:${interaction.user.id}:${cfg.announcementChannel}:${encodeURIComponent(title)}:${encodeURIComponent(description)}:${encodeURIComponent(date)}:${type}`)
        .setLabel('✅ Approve')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`event_deny:${interaction.user.id}`)
        .setLabel('❌ Deny')
        .setStyle(ButtonStyle.Danger),
    );

    const targetChannel = cfg.logChannel
      ? await interaction.client.channels.fetch(cfg.logChannel).catch(() => null)
      : null;

    if (targetChannel) {
      await targetChannel.send({ content: preview, components: [row] });
      return interaction.reply({ content: '✅ Your event request has been submitted for staff review.', ephemeral: true });
    }

    return interaction.reply({ content: preview, components: [row] });
  },
};

async function handleEventDecision(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[0];

  if (action === 'event_deny') {
    return interaction.update({
      content: `## ❌ Event Request Denied\n\nDenied by <@${interaction.user.id}>.`,
      components: [],
    });
  }

  const [, submitterId, announcementChannelId, title, description, date, type] = parts;
  const announceCh = await interaction.client.channels.fetch(announcementChannelId).catch(() => null);
  if (!announceCh) return interaction.reply({ content: '❌ Announcement channel not found.', ephemeral: true });

  const announceText =
    `## 📣 ${type} Announcement — ${decodeURIComponent(title)}\n` +
    `-# Roastin Coffee Affiliate Announcement\n\n` +
    `**Date:** ${decodeURIComponent(date)}\n\n` +
    `> ${decodeURIComponent(description)}\n\n` +
    `-# Hosted by <@${submitterId}>`;

  await announceCh.send({ content: announceText });

  return interaction.update({
    content: `## ✅ Event Approved & Posted\n\nApproved by <@${interaction.user.id}>. Posted in <#${announcementChannelId}>.`,
    components: [],
  });
}

module.exports.handleEventDecision = handleEventDecision;
