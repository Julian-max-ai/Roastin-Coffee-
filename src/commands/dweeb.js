const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { sendComponentsV2, editComponentsV2 } = require('../utils/webhook');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dweeb')
    .setDescription('Manage dweeb.faizo.net webhook integration.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('set-webhook')
      .setDescription('Save a Discord webhook URL for a channel type.')
      .addStringOption(o => o.setName('type').setDescription('Which channel').setRequired(true)
        .addChoices(
          { name: '📢 Announcement', value: 'announcementWebhook' },
          { name: '📋 Review', value: 'reviewWebhook' },
          { name: '📃 Partner List', value: 'partnerListWebhook' },
        ))
      .addStringOption(o => o.setName('url').setDescription('Discord webhook URL').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('send')
      .setDescription('Send a dweeb JSON payload to a webhook channel.')
      .addStringOption(o => o.setName('type').setDescription('Which channel').setRequired(true)
        .addChoices(
          { name: '📢 Announcement', value: 'announcementWebhook' },
          { name: '📋 Review', value: 'reviewWebhook' },
          { name: '📃 Partner List', value: 'partnerListWebhook' },
        )))
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View saved webhook URLs.')),

  async execute(interaction) {
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'set-webhook') {
      const type = interaction.options.getString('type');
      const url = interaction.options.getString('url');

      if (!url.startsWith('https://discord.com/api/webhooks/') && !url.startsWith('https://discordapp.com/api/webhooks/')) {
        return interaction.reply({ content: '❌ Invalid webhook URL. Must be a Discord webhook URL.', ephemeral: true });
      }

      await GuildConfig.findOneAndUpdate({ guildId }, { [type]: url }, { upsert: true });

      const labels = { announcementWebhook: '📢 Announcement', reviewWebhook: '📋 Review', partnerListWebhook: '📃 Partner List' };
      return interaction.reply({ content: `✅ **${labels[type]}** webhook saved.`, ephemeral: true });
    }

    if (sub === 'view') {
      const cfg = await GuildConfig.findOne({ guildId });
      return interaction.reply({
        content:
          `## 🔗 Saved Webhook URLs\n\n` +
          `> 📢 **Announcement:** ${cfg?.announcementWebhook ? '✅ Set' : '❌ Not set'}\n` +
          `> 📋 **Review:** ${cfg?.reviewWebhook ? '✅ Set' : '❌ Not set'}\n` +
          `> 📃 **Partner List:** ${cfg?.partnerListWebhook ? '✅ Set' : '❌ Not set'}\n\n` +
          `-# Use /dweeb send to post a dweeb JSON payload`,
        ephemeral: true,
      });
    }

    if (sub === 'send') {
      const type = interaction.options.getString('type');
      const cfg = await GuildConfig.findOne({ guildId });
      const webhookUrl = cfg?.[type];

      if (!webhookUrl) return interaction.reply({ content: `❌ No webhook set for this type. Use \`/dweeb set-webhook\` first.`, ephemeral: true });

      // Open modal to paste dweeb JSON
      const modal = new ModalBuilder()
        .setCustomId(`dweeb_send:${type}`)
        .setTitle('Paste Dweeb JSON Payload');

      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('json_payload')
          .setLabel('Paste the JSON from dweeb.faizo.net')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('{"components": [...]}')
          .setRequired(true)
      ));

      return interaction.showModal(modal);
    }
  },
};

async function handleDweebModal(interaction) {
  const type = interaction.customId.replace('dweeb_send:', '');
  const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
  const webhookUrl = cfg?.[type];

  if (!webhookUrl) return interaction.reply({ content: '❌ Webhook URL not found.', ephemeral: true });

  let payload;
  try {
    payload = JSON.parse(interaction.fields.getTextInputValue('json_payload'));
  } catch {
    return interaction.reply({ content: '❌ Invalid JSON. Please copy the exact JSON from dweeb.faizo.net.', ephemeral: true });
  }

  try {
    await sendComponentsV2(webhookUrl, payload);
    return interaction.reply({ content: '✅ Message sent successfully via webhook!', ephemeral: true });
  } catch (err) {
    console.error(err);
    return interaction.reply({ content: `❌ Failed to send: ${err.message}`, ephemeral: true });
  }
}

module.exports.handleDweebModal = handleDweebModal;
