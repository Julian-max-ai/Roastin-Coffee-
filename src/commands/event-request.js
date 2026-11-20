const {
  SlashCommandBuilder, EmbedBuilder,
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
      .addChoices(
        { name: 'Event', value: 'Event' },
        { name: 'Shift', value: 'Shift' },
      )),

  async execute(interaction) {
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
    if (!cfg?.announcementChannel) {
      return interaction.reply({ content: '❌ No announcement channel configured. Ask an admin to run `/config set`.', ephemeral: true });
    }

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const date = interaction.options.getString('date');
    const type = interaction.options.getString('type');

    const previewEmbed = new EmbedBuilder()
      .setColor(0x6F4E37)
      .setTitle(`📝 Event Request — Pending Approval`)
      .setDescription(
        `## ${title}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `**Type:** ${type}\n` +
        `**Date:** ${date}\n\n` +
        `### Description\n> ${description}\n\n` +
        `**Submitted by:** <@${interaction.user.id}>`
      )
      .setTimestamp()
      .setFooter({ text: 'Roastin Coffee PR System — Awaiting Staff Approval' });

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

    // Send preview to PR staff — if a log channel exists use it, otherwise reply ephemerally to staff
    const targetChannelId = cfg.logChannel || null;
    if (targetChannelId) {
      const ch = await interaction.client.channels.fetch(targetChannelId).catch(() => null);
      if (ch) {
        await ch.send({ embeds: [previewEmbed], components: [row] });
        return interaction.reply({ content: '✅ Your event request has been submitted for review.', ephemeral: true });
      }
    }

    return interaction.reply({ embeds: [previewEmbed], components: [row], ephemeral: false });
  },
};

async function handleEventDecision(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[0];

  if (action === 'event_deny') {
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('❌ Event Request Denied')
      .setDescription(`This event request has been **denied** by <@${interaction.user.id}>.`)
      .setTimestamp();
    return interaction.update({ embeds: [embed], components: [] });
  }

  // approve
  const [, submitterId, announcementChannelId, title, description, date, type] = parts;

  const announceCh = await interaction.client.channels.fetch(announcementChannelId).catch(() => null);
  if (!announceCh) return interaction.reply({ content: '❌ Announcement channel not found.', ephemeral: true });

  const announceEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle(`📣 ${type} Announcement — ${decodeURIComponent(title)}`)
    .setDescription(
      `## ${decodeURIComponent(title)}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `**Type:** ${type}\n` +
      `**Date:** ${decodeURIComponent(date)}\n\n` +
      `### Details\n> ${decodeURIComponent(description)}\n\n` +
      `*Hosted by our affiliate partner — <@${submitterId}>*`
    )
    .setTimestamp()
    .setFooter({ text: 'Roastin Coffee PR System' });

  await announceCh.send({ embeds: [announceEmbed] });

  const confirmedEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ Event Approved & Posted')
    .setDescription(`Approved by <@${interaction.user.id}>. Posted in <#${announcementChannelId}>.`)
    .setTimestamp();

  return interaction.update({ embeds: [confirmedEmbed], components: [] });
}

module.exports.handleEventDecision = handleEventDecision;
