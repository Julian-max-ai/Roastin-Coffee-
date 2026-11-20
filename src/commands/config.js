const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType,
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

function buildConfigEmbed(cfg) {
  return new EmbedBuilder()
    .setColor(0x6F4E37)
    .setTitle('⚙️ Roastin Coffee — Configuration')
    .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n*Select a setting below to change it.*')
    .addFields(
      { name: '📢 Announcement Channel', value: cfg?.announcementChannel ? `<#${cfg.announcementChannel}>` : '*Not set*', inline: true },
      { name: '📋 Review Channel',       value: cfg?.reviewChannel       ? `<#${cfg.reviewChannel}>`       : '*Not set*', inline: true },
      { name: '📝 Log Channel',          value: cfg?.logChannel          ? `<#${cfg.logChannel}>`          : '*Not set*', inline: true },
      { name: '🎫 Ticket Category',      value: cfg?.ticketCategory      ? `<#${cfg.ticketCategory}>`      : '*Not set*', inline: true },
      { name: '👔 PR Staff Role',        value: cfg?.prStaffRole         ? `<@&${cfg.prStaffRole}>`        : '*Not set*', inline: true },
      { name: '🤝 Partner Rep Role',     value: cfg?.partnerRepRole      ? `<@&${cfg.partnerRepRole}>`     : '*Not set*', inline: true },
    )
    .setFooter({ text: 'Only visible to you • Roastin Coffee PR System' })
    .setTimestamp();
}

function buildButtons() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg_announcementChannel').setLabel('📢 Announcement Channel').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg_reviewChannel').setLabel('📋 Review Channel').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg_logChannel').setLabel('📝 Log Channel').setStyle(ButtonStyle.Secondary),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('cfg_ticketCategory').setLabel('🎫 Ticket Category').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg_prStaffRole').setLabel('👔 PR Staff Role').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cfg_partnerRepRole').setLabel('🤝 Partner Rep Role').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Open the server configuration panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
    await interaction.reply({
      embeds: [buildConfigEmbed(cfg)],
      components: buildButtons(),
      ephemeral: true,
    });
  },
};

// Channel settings
const CHANNEL_KEYS = ['announcementChannel', 'reviewChannel', 'logChannel', 'ticketCategory'];
const ROLE_KEYS    = ['prStaffRole', 'partnerRepRole'];

const LABELS = {
  announcementChannel: '📢 Announcement Channel',
  reviewChannel:       '📋 Review Channel',
  logChannel:          '📝 Log Channel',
  ticketCategory:      '🎫 Ticket Category',
  prStaffRole:         '👔 PR Staff Role',
  partnerRepRole:      '🤝 Partner Rep Role',
};

async function handleConfigButton(interaction) {
  const key = interaction.customId.replace('cfg_', '');

  if (CHANNEL_KEYS.includes(key)) {
    const isCategory = key === 'ticketCategory';
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder()
        .setCustomId(`cfg_select:${key}`)
        .setPlaceholder(`Select ${LABELS[key]}`)
        .addChannelTypes(isCategory ? ChannelType.GuildCategory : ChannelType.GuildText)
    );
    return interaction.reply({
      content: `**Select the ${LABELS[key]}:**`,
      components: [row],
      ephemeral: true,
    });
  }

  if (ROLE_KEYS.includes(key)) {
    const row = new ActionRowBuilder().addComponents(
      new RoleSelectMenuBuilder()
        .setCustomId(`cfg_select:${key}`)
        .setPlaceholder(`Select ${LABELS[key]}`)
    );
    return interaction.reply({
      content: `**Select the ${LABELS[key]}:**`,
      components: [row],
      ephemeral: true,
    });
  }
}

async function handleConfigSelect(interaction) {
  const key = interaction.customId.replace('cfg_select:', '');
  const value = interaction.values[0];
  const { guildId } = interaction;

  await GuildConfig.findOneAndUpdate({ guildId }, { [key]: value }, { upsert: true, new: true });

  const cfg = await GuildConfig.findOne({ guildId });

  await interaction.update({
    content: `✅ **${LABELS[key]}** has been updated!`,
    components: [],
  });

  // Refresh the original config panel
  await interaction.followUp({
    embeds: [buildConfigEmbed(cfg)],
    components: buildButtons(),
    ephemeral: true,
  });
}

module.exports.handleConfigButton = handleConfigButton;
module.exports.handleConfigSelect = handleConfigSelect;
