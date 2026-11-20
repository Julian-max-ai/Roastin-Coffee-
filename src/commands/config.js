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
        { label: '👥 Roles', value: 'roles', description: 'PR staff and partner representative roles' },
        { label: '📋 Review System', value: 'review', description: 'Review mode, link and questions' },
        { label: '✏️ Custom Texts', value: 'texts', description: 'Partner list, ticket panel and review texts' },
        { label: '⚙️ Automation', value: 'automation', description: 'Ticket, infraction, review and event automation' },
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

  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_category') {
    const cat = interaction.values[0];

    if (cat === 'channels') {
      return interaction.update(configPanel(await GuildConfig.findOne({ guildId }), [
        new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder().setCustomId('cfg_ch_pick').setPlaceholder('Which channel to set?').addOptions([
            { label: '📢 Announcement Channel', value: 'announcementChannel' },
            { label: '📋 Review Channel', value: 'reviewChannel' },
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
      return interaction.update(configPanel(await GuildConfig.findOne({ guildId }), [
        new ActionRowBuilder().addComponents(
          new RoleSelectMenuBuilder().setCustomId('cfg_prStaffRoles').setPlaceholder('👔 PR Staff Roles').setMinValues(1).setMaxValues(5)
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
      return interaction.update(configPanel(await GuildConfig.findOne({ guildId }), [
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
      return interaction.update(configPanel(await GuildConfig.findOne({ guildId }), [
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

    if (cat === 'automation') {
      const cfg = await GuildConfig.findOne({ guildId });
      return interaction.update(automationPanel(cfg));
    }
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_ch_pick') {
    const key = interaction.values[0];
    return interaction.update(configPanel(await GuildConfig.findOne({ guildId }), [
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
    return interaction.update(configPanel(cfg, [mainMenu()]));
  }

  if (interaction.isRoleSelectMenu()) {
    const key = interaction.customId;
    if (!['cfg_prStaffRoles', 'cfg_partnerRepRoles'].includes(key)) return;
    await GuildConfig.findOneAndUpdate({ guildId }, { [key.replace('cfg_', '')]: interaction.values }, { upsert: true });
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.update(configPanel(cfg, [mainMenu()]));
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'cfg_reviewMode') {
    await GuildConfig.findOneAndUpdate({ guildId }, { reviewMode: interaction.values[0] }, { upsert: true });
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.update(configPanel(cfg, [mainMenu()]));
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
        .setLabel('One question per line (max 5, max 45 chars each)')
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
      return interaction.reply(successCard('Text updated successfully.'));
    }
    if (interaction.customId === 'cfg_reviewLink_modal') {
      const value = interaction.fields.getTextInputValue('link_value');
      await GuildConfig.findOneAndUpdate({ guildId }, { reviewLink: value }, { upsert: true });
      return interaction.reply(successCard('Review link updated.'));
    }
    if (interaction.customId === 'cfg_reviewQuestions_modal') {
      const raw = interaction.fields.getTextInputValue('questions_value');
      const questions = raw.split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 0)
        .slice(0, 5)
        .map(q => q.slice(0, 45));
      if (questions.length === 0) {
        return interaction.reply(errorCard('Please enter at least one question.'));
      }
      await GuildConfig.findOneAndUpdate({ guildId }, { reviewQuestions: questions }, { upsert: true });
      return interaction.reply(successCard(`Review questions updated (${questions.length}).`));
    }
  }

  if (interaction.isButton() && interaction.customId === 'cfg_back') {
    const cfg = await GuildConfig.findOne({ guildId });
    return interaction.update(configPanel(cfg, [mainMenu()]));
  }
}

module.exports.handleConfigInteraction = handleConfigInteraction;
