'use strict';
const {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, StringSelectMenuBuilder,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder,
  ButtonBuilder, ButtonStyle, ChannelType,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { configPanel, automationPanel, successCard, errorCard } = require('../ui');

function mainMenu() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('cfg_category')
      .setPlaceholder('Select a category to configure...')
      .addOptions([
        { label: '📢 Channels', value: 'channels', description: 'Announcement, review, log, partner list, ticket category' },
        { label: '👥 Roles', value: 'roles', description: 'Public Relations staff and partner representative roles' },
        { label: '📋 Review System', value: 'review', description: 'Review mode, link and questions' },
        { label: '✏️ Custom Texts', value: 'texts', description: 'Partner list, ticket panel and review texts' },
        { label: '⚙️ Automation', value: 'automation', description: 'Ticket, infraction, review and event automation' },
        { label: '🔐 Rights', value: 'rights', description: 'Admin, Public Relations staff and partner rep roles' },
      ])
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Open the server configuration panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
    await interaction.editReply(configPanel(cfg, [mainMenu()]));
  },
};

async function handleConfigInteraction(interaction) {
  const { guildId } = interaction;
  const isModal = interaction.isModalSubmit();

  // Defer before async DB work to prevent Discord interaction timeout (>3s).
  // Modal-opening interactions (showModal) must be called directly and are excluded.
  const opensModal =
    (interaction.isStringSelectMenu() && interaction.customId === 'cfg_auto_pick') ||
    (interaction.isStringSelectMenu() && interaction.customId === 'cfg_text_pick') ||
    (interaction.isButton() && interaction.customId === 'cfg_setReviewLink') ||
    (interaction.isButton() && interaction.customId === 'cfg_setReviewQuestions');

  if (isModal) {
    await interaction.deferReply({ ephemeral: true });
  } else if (!opensModal) {
    if (interaction.isButton() || interaction.isAnySelectMenu()) {
      await interaction.deferUpdate();
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_category') {
    const cat = interaction.values[0];

    if (cat === 'channels') {
      return interaction.editReply(configPanel(await GuildConfig.findOne({ guildId }), [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('cfg_ch_pick').setPlaceholder('Which channel to set?').addOptions([
            { label: '📢 Announcement Channel', value: 'announcementChannel' },
            { label: '📝 Log Channel', value: 'logChannel' },
            { label: '📃 Partner List Channel', value: 'partnerListChannel' },
          ])
        ),
        new ActionRowBuilder().addComponents(
          new ChannelSelectMenuBuilder().setCustomId('cfg_ticketCategory').setPlaceholder('🎫 Ticket Category').addChannelTypes(ChannelType.GuildCategory)
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
        ),
      ]));
    }

    if (cat === 'roles') {
      return interaction.editReply(configPanel(await GuildConfig.findOne({ guildId }), [
        new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId('cfg_prStaffRoles').setPlaceholder('👔 Public Relations Staff Roles').setMinValues(1).setMaxValues(5)
        ),
        new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId('cfg_partnerRepRoles').setPlaceholder('🤝 Partner Rep Roles').setMinValues(1).setMaxValues(5)
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
        ),
      ]));
    }

    if (cat === 'review') {
      return interaction.editReply(configPanel(await GuildConfig.findOne({ guildId }), [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('cfg_reviewMode').setPlaceholder('Review mode...').addOptions([
            { label: '💬 In-Discord Form', value: 'dm', description: 'Bot sends a modal with questions' },
            { label: '🔗 External Link', value: 'link', description: 'Button links to Google Doc or form' },
          ])
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_setReviewLink').setLabel('🔗 Set Review Link').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('cfg_setReviewQuestions').setLabel('❓ Set Review Questions').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary),
        ),
      ]));
    }

    if (cat === 'texts') {
      return interaction.editReply(configPanel(await GuildConfig.findOne({ guildId }), [
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
      ]));
    }

    if (cat === 'rights') {
      const cfg = await GuildConfig.findOne({ guildId });
      return interaction.editReply(configPanel(cfg, [
        new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId('cfg_adminRoles').setPlaceholder('🔐 Admin Roles').setMinValues(0).setMaxValues(5)
        ),
        new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId('cfg_prStaffRoles').setPlaceholder('👔 Public Relations Staff Roles').setMinValues(0).setMaxValues(5)
        ),
        new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId('cfg_partnerRepRoles').setPlaceholder('🤝 Partner Rep Roles').setMinValues(0).setMaxValues(5)
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
        ),
      ]));
    }

    if (cat === 'automation') {
      const cfg = await GuildConfig.findOne({ guildId });
      return interaction.editReply(automationPanel(cfg, [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('cfg_auto_pick').setPlaceholder('Which setting to change?').addOptions([
            { label: 'Ticket Inactivity Reminder', value: 'ticketInactivityEnabled', description: 'Toggle on/off' },
            { label: 'Ticket Inactivity Hours', value: 'ticketInactivityHours', description: 'Set hours (0-720)' },
            { label: 'Ticket Auto-Close', value: 'ticketAutoCloseEnabled', description: 'Toggle on/off' },
            { label: 'Ticket Auto-Close Hours', value: 'ticketAutoCloseHours', description: 'Set hours (1-720)' },
            { label: 'Close Request Timeout', value: 'ticketCloseRequestHours', description: 'Set hours (1-720)' },
            { label: 'Max Open Tickets/User', value: 'maxOpenTicketsPerUser', description: 'Set count (1-10)' },
            { label: 'Ticket Rating', value: 'ticketRatingEnabled', description: 'Toggle on/off' },
            { label: 'Infraction Expiry (Warning)', value: 'infractionExpiryWarning', description: 'Set days (0=never)' },
            { label: 'Infraction Expiry (Strike)', value: 'infractionExpiryStrike', description: 'Set days (0=never)' },
            { label: 'Review Reminder Days', value: 'reviewReminderDays', description: 'Set days (0=never)' },
            { label: 'Review Overdue Days', value: 'reviewOverdueDays', description: 'Set days (0=never)' },
            { label: 'Event Reminder Hours', value: 'eventReminderHours', description: 'Set hours (0=never)' },
            { label: 'Anniversary Announcements', value: 'anniversaryAnnouncements', description: 'Toggle on/off' },
            { label: 'Invite Health Check', value: 'inviteHealthCheck', description: 'Toggle on/off' },
            { label: 'Auto-Assign Rep Roles', value: 'autoAssignRepRoles', description: 'Toggle on/off' },
            { label: 'Weekly Event Digest', value: 'weeklyEventDigest', description: 'Toggle on/off' },
          ])
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
        ),
      ]));
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_auto_pick') {
    const key = interaction.values[0];
    const cfg = await GuildConfig.findOne({ guildId });
    const a = cfg?.automation || {};
    const isBool = ['ticketInactivityEnabled','ticketAutoCloseEnabled','ticketRatingEnabled','anniversaryAnnouncements','inviteHealthCheck','autoAssignRepRoles','weeklyEventDigest'].includes(key);
    const current = a[key];

    if (isBool) {
      await interaction.deferUpdate();
      const newVal = !current;
      await GuildConfig.findOneAndUpdate({ guildId }, { [`automation.${key}`]: newVal }, { upsert: true });
      const updated = await GuildConfig.findOne({ guildId });
      return interaction.editReply(automationPanel(updated, [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('cfg_auto_pick').setPlaceholder('Which setting to change?').addOptions([
            { label: 'Ticket Inactivity Reminder', value: 'ticketInactivityEnabled', description: 'Toggle on/off' },
            { label: 'Ticket Inactivity Hours', value: 'ticketInactivityHours', description: 'Set hours (0-720)' },
            { label: 'Ticket Auto-Close', value: 'ticketAutoCloseEnabled', description: 'Toggle on/off' },
            { label: 'Ticket Auto-Close Hours', value: 'ticketAutoCloseHours', description: 'Set hours (1-720)' },
            { label: 'Close Request Timeout', value: 'ticketCloseRequestHours', description: 'Set hours (1-720)' },
            { label: 'Max Open Tickets/User', value: 'maxOpenTicketsPerUser', description: 'Set count (1-10)' },
            { label: 'Ticket Rating', value: 'ticketRatingEnabled', description: 'Toggle on/off' },
            { label: 'Infraction Expiry (Warning)', value: 'infractionExpiryWarning', description: 'Set days (0=never)' },
            { label: 'Infraction Expiry (Strike)', value: 'infractionExpiryStrike', description: 'Set days (0=never)' },
            { label: 'Review Reminder Days', value: 'reviewReminderDays', description: 'Set days (0=never)' },
            { label: 'Review Overdue Days', value: 'reviewOverdueDays', description: 'Set days (0=never)' },
            { label: 'Event Reminder Hours', value: 'eventReminderHours', description: 'Set hours (0=never)' },
            { label: 'Anniversary Announcements', value: 'anniversaryAnnouncements', description: 'Toggle on/off' },
            { label: 'Invite Health Check', value: 'inviteHealthCheck', description: 'Toggle on/off' },
            { label: 'Auto-Assign Rep Roles', value: 'autoAssignRepRoles', description: 'Toggle on/off' },
            { label: 'Weekly Event Digest', value: 'weeklyEventDigest', description: 'Toggle on/off' },
          ])
        ),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
        ),
      ]));
    } else {
      const modal = new ModalBuilder().setCustomId(`cfg_auto_value:${key}`).setTitle(`Set ${key}`);
      const limits = {
        ticketInactivityHours: { label: 'Hours (0-720)', placeholder: 'e.g. 24' },
        ticketAutoCloseHours: { label: 'Hours (1-720)', placeholder: 'e.g. 48' },
        ticketCloseRequestHours: { label: 'Hours (1-720)', placeholder: 'e.g. 24' },
        maxOpenTicketsPerUser: { label: 'Count (1-10)', placeholder: 'e.g. 3' },
        infractionExpiryWarning: { label: 'Days (0=never)', placeholder: 'e.g. 90' },
        infractionExpiryStrike: { label: 'Days (0=never)', placeholder: 'e.g. 180' },
        reviewReminderDays: { label: 'Days (0=never)', placeholder: 'e.g. 7' },
        reviewOverdueDays: { label: 'Days (0=never)', placeholder: 'e.g. 14' },
        eventReminderHours: { label: 'Hours (0=never)', placeholder: 'e.g. 1' },
      };
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('auto_value').setLabel(limits[key]?.label || 'Value').setStyle(TextInputStyle.Short).setValue(String(current ?? '')).setPlaceholder(limits[key]?.placeholder || '').setRequired(true)
      ));
      return interaction.showModal(modal);
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('cfg_auto_value:')) {
    const key = interaction.customId.replace('cfg_auto_value:', '');
    const raw = interaction.fields.getTextInputValue('auto_value');
    const num = parseInt(raw, 10);
    if (isNaN(num) || num < 0) return interaction.editReply(errorCard('Please enter a valid non-negative number.'));

    const maxMap = {
      ticketInactivityHours: 720, ticketAutoCloseHours: 720, ticketCloseRequestHours: 720,
      maxOpenTicketsPerUser: 10, infractionExpiryWarning: 3650, infractionExpiryStrike: 3650,
      reviewReminderDays: 365, reviewOverdueDays: 365, eventReminderHours: 8760,
    };
    const max = maxMap[key] ?? 999999;
    if (num > max) return interaction.editReply(errorCard(`Value must be ≤ ${max}.`));

    await GuildConfig.findOneAndUpdate({ guildId }, { [`automation.${key}`]: num }, { upsert: true });
    const updated = await GuildConfig.findOne({ guildId });
    return interaction.editReply(automationPanel(updated, [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('cfg_auto_pick').setPlaceholder('Which setting to change?').addOptions([
          { label: 'Ticket Inactivity Reminder', value: 'ticketInactivityEnabled', description: 'Toggle on/off' },
          { label: 'Ticket Inactivity Hours', value: 'ticketInactivityHours', description: 'Set hours (0-720)' },
          { label: 'Ticket Auto-Close', value: 'ticketAutoCloseEnabled', description: 'Toggle on/off' },
          { label: 'Ticket Auto-Close Hours', value: 'ticketAutoCloseHours', description: 'Set hours (1-720)' },
          { label: 'Close Request Timeout', value: 'ticketCloseRequestHours', description: 'Set hours (1-720)' },
          { label: 'Max Open Tickets/User', value: 'maxOpenTicketsPerUser', description: 'Set count (1-10)' },
          { label: 'Ticket Rating', value: 'ticketRatingEnabled', description: 'Toggle on/off' },
          { label: 'Infraction Expiry (Warning)', value: 'infractionExpiryWarning', description: 'Set days (0=never)' },
          { label: 'Infraction Expiry (Strike)', value: 'infractionExpiryStrike', description: 'Set days (0=never)' },
          { label: 'Review Reminder Days', value: 'reviewReminderDays', description: 'Set days (0=never)' },
          { label: 'Review Overdue Days', value: 'reviewOverdueDays', description: 'Set days (0=never)' },
          { label: 'Event Reminder Hours', value: 'eventReminderHours', description: 'Set hours (0=never)' },
          { label: 'Anniversary Announcements', value: 'anniversaryAnnouncements', description: 'Toggle on/off' },
          { label: 'Invite Health Check', value: 'inviteHealthCheck', description: 'Toggle on/off' },
          { label: 'Auto-Assign Rep Roles', value: 'autoAssignRepRoles', description: 'Toggle on/off' },
          { label: 'Weekly Event Digest', value: 'weeklyEventDigest', description: 'Toggle on/off' },
        ])
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
      ),
    ]));
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_ch_pick') {
    const key = interaction.values[0];
    return interaction.editReply(configPanel(await GuildConfig.findOne({ guildId }), [
      new ActionRowBuilder().addComponents(
        new ChannelSelectMenuBuilder().setCustomId(`cfg_channel:${key}`).setPlaceholder('Select channel...').addChannelTypes(ChannelType.GuildText)
      ),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('cfg_back').setLabel('← Back').setStyle(ButtonStyle.Secondary)
      ),
    ]));
  }

  if (interaction.isChannelSelectMenu()) {
    const key = interaction.customId.startsWith('cfg_channel:')
      ? interaction.customId.replace('cfg_channel:', '')
      : interaction.customId === 'cfg_ticketCategory' ? 'ticketCategory' : null;
    if (!key) return;
    await GuildConfig.findOneAndUpdate({ guildId }, { [key]: interaction.values[0] }, { upsert: true });
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.editReply(configPanel(cfg, [mainMenu()]));
  }

  if (interaction.isRoleSelectMenu()) {
    const key = interaction.customId;
    if (!['cfg_adminRoles', 'cfg_prStaffRoles', 'cfg_partnerRepRoles'].includes(key)) return;
    const field = key === 'cfg_adminRoles' ? 'adminRoles' : key.replace('cfg_', '');
    await GuildConfig.findOneAndUpdate({ guildId }, { [field]: interaction.values }, { upsert: true });
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.editReply(configPanel(cfg, [mainMenu()]));
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_reviewMode') {
    await GuildConfig.findOneAndUpdate({ guildId }, { reviewMode: interaction.values[0] }, { upsert: true });
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.editReply(configPanel(cfg, [mainMenu()]));
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_text_pick') {
    const key    = interaction.values[0];
    const cfg    = await GuildConfig.findOne({ guildId });
    const labels = { partnerListText: 'Partner List Text', ticketPanelText: 'Ticket Panel Text', reviewText: 'Review Message Text' };
    const modal  = new ModalBuilder().setCustomId(`cfg_text_modal:${key}`).setTitle(`Edit ${labels[key]}`.slice(0, 45));
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('text_value').setLabel(labels[key]).setStyle(TextInputStyle.Paragraph).setValue(cfg?.[key] ?? '').setRequired(true)
    ));
    return interaction.showModal(modal);
  }

  if (interaction.isButton() && interaction.customId === 'cfg_setReviewLink') {
    const cfg   = await GuildConfig.findOne({ guildId });
    const modal = new ModalBuilder().setCustomId('cfg_reviewLink_modal').setTitle('Set Review Link');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('link_value').setLabel('Review Link (Google Doc, Form, etc.)').setStyle(TextInputStyle.Short).setValue(cfg?.reviewLink ?? '').setRequired(true)
    ));
    return interaction.showModal(modal);
  }

  if (interaction.isButton() && interaction.customId === 'cfg_setReviewQuestions') {
    const cfg = await GuildConfig.findOne({ guildId });
    const current = (cfg?.reviewQuestions || []).join('\n');
    const modal = new ModalBuilder().setCustomId('cfg_reviewQuestions_modal').setTitle('Set Review Questions');
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('questions_value')
        .setLabel('Review questions (one per line)')
        .setStyle(TextInputStyle.Paragraph)
        .setValue(current)
        .setRequired(true)
    ));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('cfg_text_modal:')) {
      const key   = interaction.customId.replace('cfg_text_modal:', '');
      const value = interaction.fields.getTextInputValue('text_value');
      await GuildConfig.findOneAndUpdate({ guildId }, { [key]: value }, { upsert: true });
      return interaction.editReply(successCard('Text updated successfully.'));
    }
    if (interaction.customId === 'cfg_reviewLink_modal') {
      const value = interaction.fields.getTextInputValue('link_value');
      await GuildConfig.findOneAndUpdate({ guildId }, { reviewLink: value }, { upsert: true });
      return interaction.editReply(successCard('Review link updated.'));
    }
    if (interaction.customId === 'cfg_reviewQuestions_modal') {
      const raw = interaction.fields.getTextInputValue('questions_value');
      const questions = raw.split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0)
        .slice(0, 5)
        .map(q => q.slice(0, 45));
      if (questions.length === 0) {
        return interaction.editReply(errorCard('Please enter at least one question.'));
      }
      await GuildConfig.findOneAndUpdate({ guildId }, { reviewQuestions: questions }, { upsert: true });
      return interaction.editReply(successCard(`Review questions updated (${questions.length}).`));
    }
  }

  if (interaction.isButton() && interaction.customId === 'cfg_back') {
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.editReply(configPanel(cfg, [mainMenu()]));
  }
}

module.exports.handleConfigInteraction = handleConfigInteraction;
