const {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

const CATEGORIES = [
  { label: '📢 Channels', value: 'channels', description: 'Set announcement, log, review & partner list channels' },
  { label: '👥 Roles', value: 'roles', description: 'Set PR staff and partner representative roles' },
  { label: '📋 Review System', value: 'review', description: 'Configure monthly review mode and settings' },
  { label: '✏️ Custom Texts', value: 'texts', description: 'Edit partner list, ticket panel and review texts' },
];

function cfgValue(cfg, key) {
  if (!cfg || !cfg[key]) return '*Not set*';
  if (Array.isArray(cfg[key])) return cfg[key].length ? cfg[key].map(id => key.includes('Role') || key.includes('role') ? `<@&${id}>` : `<#${id}>`).join(', ') : '*Not set*';
  if (key.includes('Channel') || key.includes('channel')) return `<#${cfg[key]}>`;
  if (key.includes('Role') || key.includes('role')) return `<@&${cfg[key]}>`;
  return cfg[key];
}

function mainMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cfg_category')
      .setPlaceholder('Select a category to configure...')
      .addOptions(CATEGORIES)
  );
}

function configSummary(cfg) {
  return (
    `## ⚙️ Server Configuration\n` +
    `-# Roastin Coffee PR System\n\n` +
    `### 📢 Channels\n` +
    `> Announcement: ${cfgValue(cfg, 'announcementChannel')}\n` +
    `> Review: ${cfgValue(cfg, 'reviewChannel')}\n` +
    `> Log: ${cfgValue(cfg, 'logChannel')}\n` +
    `> Partner List: ${cfgValue(cfg, 'partnerListChannel')}\n` +
    `> Ticket Category: ${cfgValue(cfg, 'ticketCategory')}\n\n` +
    `### 👥 Roles\n` +
    `> PR Staff: ${cfg?.prStaffRoles?.length ? cfg.prStaffRoles.map(r => `<@&${r}>`).join(', ') : '*Not set*'}\n` +
    `> Partner Rep: ${cfg?.partnerRepRoles?.length ? cfg.partnerRepRoles.map(r => `<@&${r}>`).join(', ') : '*Not set*'}\n\n` +
    `### 📋 Review\n` +
    `> Mode: ${cfg?.reviewMode === 'dm' ? '💬 DM Questions' : '🔗 External Link'}\n` +
    `> Link: ${cfg?.reviewLink ?? '*Not set*'}\n\n` +
    `-# Select a category below to edit settings`
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Open the server configuration panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
    await interaction.reply({ content: configSummary(cfg), components: [mainMenu()], ephemeral: true });
  },
};

async function handleConfigInteraction(interaction) {
  const { guildId } = interaction;

  // Category selected
  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_category') {
    const cat = interaction.values[0];

    if (cat === 'channels') {
      const rows = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('cfg_ch_pick').setPlaceholder('Which channel to set?').addOptions([
            { label: '📢 Announcement Channel', value: 'announcementChannel' },
            { label: '📋 Review Channel', value: 'reviewChannel' },
            { label: '📝 Log Channel', value: 'logChannel' },
            { label: '📃 Partner List Channel', value: 'partnerListChannel' },
          ])
        ),
        new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder().setCustomId('cfg_ticketCategory').setPlaceholder('🎫 Select Ticket Category').addChannelTypes(ChannelType.GuildCategory)
        ),
      ];
      return interaction.update({ content: `### 📢 Channel Settings\n> Select which channel to configure:`, components: rows });
    }

    if (cat === 'roles') {
      const rows = [
        new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId('cfg_prStaffRoles').setPlaceholder('👔 Select PR Staff Roles').setMinValues(1).setMaxValues(5)
        ),
        new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId('cfg_partnerRepRoles').setPlaceholder('🤝 Select Partner Rep Roles').setMinValues(1).setMaxValues(5)
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
        ),
      ];
      return interaction.update({ content: `### 👥 Role Settings\n> Select roles for each category:`, components: rows });
    }

    if (cat === 'review') {
      const rows = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('cfg_reviewMode').setPlaceholder('Select review mode...').addOptions([
            { label: '💬 DM Questions', value: 'dm', description: 'Bot sends questions via DM' },
            { label: '🔗 External Link', value: 'link', description: 'Button links to Google Doc or form' },
          ])
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_setReviewLink').setLabel('🔗 Set Review Link').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
        ),
      ];
      return interaction.update({ content: `### 📋 Review System\n> Configure how monthly reviews work:`, components: rows });
    }

    if (cat === 'texts') {
      const rows = [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('cfg_text_pick').setPlaceholder('Which text to edit?').addOptions([
            { label: '📃 Partner List Text', value: 'partnerListText', description: 'Use {partners} as placeholder' },
            { label: '🎫 Ticket Panel Text', value: 'ticketPanelText' },
            { label: '📋 Review Message Text', value: 'reviewText' },
          ])
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
        ),
      ];
      return interaction.update({ content: `### ✏️ Custom Texts\n> Select which text to edit:\n> *Use \`{partners}\` in partner list text as placeholder for the partner list.*`, components: rows });
    }
  }

  // Channel type picker
  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_ch_pick') {
    const key = interaction.values[0];
    const row = new ActionRowBuilder().addComponents(
      new ChannelSelectMenuBuilder().setCustomId(`cfg_channel:${key}`).setPlaceholder('Select channel...').addChannelTypes(ChannelType.GuildText)
    );
    return interaction.update({ content: `> Select the channel:`, components: [row] });
  }

  // Channel selected
  if (interaction.isChannelSelectMenu()) {
    const key = interaction.customId.startsWith('cfg_channel:')
      ? interaction.customId.replace('cfg_channel:', '')
      : interaction.customId === 'cfg_ticketCategory' ? 'ticketCategory' : null;
    if (!key) return;
    await GuildConfig.findOneAndUpdate({ guildId }, { [key]: interaction.values[0] }, { upsert: true, new: true });
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.update({ content: `✅ Updated!\n\n${configSummary(cfg)}`, components: [mainMenu()] });
  }

  // Role selected
  if (interaction.isRoleSelectMenu()) {
    const key = interaction.customId;
    if (!['cfg_prStaffRoles', 'cfg_partnerRepRoles'].includes(key)) return;
    const field = key.replace('cfg_', '');
    await GuildConfig.findOneAndUpdate({ guildId }, { [field]: interaction.values }, { upsert: true, new: true });
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.update({ content: `✅ Updated!\n\n${configSummary(cfg)}`, components: [mainMenu()] });
  }

  // Review mode
  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_reviewMode') {
    await GuildConfig.findOneAndUpdate({ guildId }, { reviewMode: interaction.values[0] }, { upsert: true });
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.update({ content: `✅ Updated!\n\n${configSummary(cfg)}`, components: [mainMenu()] });
  }

  // Text picker → open modal
  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_text_pick') {
    const key = interaction.values[0];
    const cfg = await GuildConfig.findOne({ guildId });
    const labels = { partnerListText: 'Partner List Text', ticketPanelText: 'Ticket Panel Text', reviewText: 'Review Message Text' };
    const modal = new ModalBuilder().setCustomId(`cfg_text_modal:${key}`).setTitle(`Edit ${labels[key]}`);
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('text_value').setLabel(labels[key]).setStyle(TextInputStyle.Paragraph)
        .setValue(cfg?.[key] ?? '').setRequired(true)
    ));
    return interaction.showModal(modal);
  }

  // Review link modal
  if (interaction.isButton() && interaction.customId === 'cfg_setReviewLink') {
    const cfg = await GuildConfig.findOne({ guildId });
    const modal = new ModalBuilder().setCustomId('cfg_reviewLink_modal').setTitle('Set Review Link');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('link_value').setLabel('Review Link (Google Doc, Form, etc.)')
        .setStyle(TextInputStyle.Short).setValue(cfg?.reviewLink ?? '').setRequired(true)
    ));
    return interaction.showModal(modal);
  }

  // Modal submits
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('cfg_text_modal:')) {
      const key = interaction.customId.replace('cfg_text_modal:', '');
      const value = interaction.fields.getTextInputValue('text_value');
      await GuildConfig.findOneAndUpdate({ guildId }, { [key]: value }, { upsert: true });
      return interaction.reply({ content: `✅ Text updated successfully.`, ephemeral: true });
    }
    if (interaction.customId === 'cfg_reviewLink_modal') {
      const value = interaction.fields.getTextInputValue('link_value');
      await GuildConfig.findOneAndUpdate({ guildId }, { reviewLink: value }, { upsert: true });
      return interaction.reply({ content: `✅ Review link updated to: ${value}`, ephemeral: true });
    }
  }

  // Back button
  if (interaction.isButton() && interaction.customId === 'cfg_back') {
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.update({ content: configSummary(cfg), components: [mainMenu()] });
  }
}

module.exports.handleConfigInteraction = handleConfigInteraction;
