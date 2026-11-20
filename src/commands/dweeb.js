const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v10');
const GuildConfig = require('../models/GuildConfig');

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dweeb')
    .setDescription('Send a dweeb.faizo.net Components V2 message.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('send')
      .setDescription('Send a dweeb JSON payload to a channel.')
      .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('Edit an existing dweeb message.')
      .addChannelOption(o => o.setName('channel').setDescription('Channel with the message').setRequired(true))
      .addStringOption(o => o.setName('message_id').setDescription('Message ID to edit').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');

    if (sub === 'send') {
      const modal = new ModalBuilder()
        .setCustomId(`dweeb_send:${channel.id}`)
        .setTitle('Paste Dweeb JSON Payload');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('json_payload')
          .setLabel('JSON from dweeb.faizo.net → Export → JSON')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('{"components": [...], "flags": 32768}')
          .setRequired(true)
      ));
      return interaction.showModal(modal);
    }

    if (sub === 'edit') {
      const messageId = interaction.options.getString('message_id');
      const modal = new ModalBuilder()
        .setCustomId(`dweeb_edit:${channel.id}:${messageId}`)
        .setTitle('Edit Dweeb Message');
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('json_payload')
          .setLabel('New JSON from dweeb.faizo.net')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ));
      return interaction.showModal(modal);
    }
  },
};

async function handleDweebModal(interaction) {
  const parts = interaction.customId.split(':');
  const action = parts[0];
  const channelId = parts[1];

  let payload;
  try {
    payload = JSON.parse(interaction.fields.getTextInputValue('json_payload'));
    payload = cleanPayload(payload);
    payload.flags = 32768;
  } catch {
    return interaction.reply({ content: '❌ Invalid JSON.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    if (action === 'dweeb_send') {
      await rest.post(Routes.channelMessages(channelId), { body: payload });
      return interaction.editReply({ content: `✅ Message sent in <#${channelId}>!` });
    }

    if (action === 'dweeb_edit') {
      const messageId = parts[2];
      await rest.patch(Routes.channelMessage(channelId, messageId), { body: payload });
      return interaction.editReply({ content: `✅ Message updated in <#${channelId}>!` });
    }
  } catch (err) {
    console.error(err);
    return interaction.editReply({ content: `❌ Failed: ${err.message}` });
  }
}

function cleanPayload(payload) {
  if (!payload?.components) return payload;
  payload.components = payload.components.map(cleanComponent).filter(Boolean);
  return payload;
}

function cleanComponent(c) {
  if (!c) return null;
  if (c.type === 12) {
    c.items = (c.items || []).filter(item => item?.media?.url && item.media.url.trim() !== '');
    if (!c.items.length) return null;
  }
  if (Array.isArray(c.components)) {
    c.components = c.components.map(cleanComponent).filter(Boolean);
    if (c.type === 17 && !c.components.length) return null;
  }
  return c;
}

module.exports.handleDweebModal = handleDweebModal;
