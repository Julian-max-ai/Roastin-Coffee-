const {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionsBitField,
  StringSelectMenuBuilder,
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const TicketType = require('../models/TicketType');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-panel')
    .setDescription('Manage the ticket panel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub.setName('post').setDescription('Post the ticket panel in this channel.'))
    .addSubcommand(sub => sub
      .setName('create-type')
      .setDescription('Create a new ticket type.')
      .addStringOption(o => o.setName('name').setDescription('Ticket type name').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji for this type').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('Short description').setRequired(true))
      .addStringOption(o => o.setName('questions').setDescription('Questions separated by | (pipe)').setRequired(true))
      .addRoleOption(o => o.setName('staff_role').setDescription('Staff role for this ticket type').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('list-types')
      .setDescription('List all ticket types.')),

  async execute(interaction) {
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'create-type') {
      const name = interaction.options.getString('name');
      const emoji = interaction.options.getString('emoji');
      const description = interaction.options.getString('description');
      const questions = interaction.options.getString('questions').split('|').map(q => q.trim());
      const staffRole = interaction.options.getRole('staff_role');

      await TicketType.create({ guildId, name, emoji, description, questions, staffRoles: [staffRole.id] });

      return interaction.reply({
        content:
          `## ✅ Ticket Type Created\n\n` +
          `**${emoji} ${name}**\n` +
          `> ${description}\n\n` +
          `**Questions:**\n${questions.map((q, i) => `> **${i + 1}.** ${q}`).join('\n')}\n` +
          `**Staff Role:** <@&${staffRole.id}>`,
        ephemeral: true,
      });
    }

    if (sub === 'list-types') {
      const types = await TicketType.find({ guildId });
      if (!types.length) return interaction.reply({ content: '❌ No ticket types created yet. Use `/ticket-panel create-type`.', ephemeral: true });

      let msg = `## 🎫 Ticket Types\n-# ${types.length} type(s)\n\n`;
      for (const t of types) {
        msg += `**${t.emoji} ${t.name}**\n> ${t.description}\n\n`;
      }
      return interaction.reply({ content: msg, ephemeral: true });
    }

    if (sub === 'post') {
      const cfg = await GuildConfig.findOne({ guildId });
      const types = await TicketType.find({ guildId });

      if (!types.length) return interaction.reply({ content: '❌ No ticket types found. Create one with `/ticket-panel create-type` first.', ephemeral: true });

      const text = cfg?.ticketPanelText || '## 🎫 Support & Partnership\n\nSelect an option below to open a ticket.';

      // Max 5 buttons per row, max 25 options in select menu
      const rows = [];
      if (types.length <= 5) {
        const row = new ActionRowBuilder();
        for (const t of types) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`ticket_open:${t._id}`)
              .setLabel(`${t.emoji} ${t.name}`)
              .setStyle(ButtonStyle.Primary)
          );
        }
        rows.push(row);
      } else {
        rows.push(new ActionRowBuilder().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId('ticket_select')
            .setPlaceholder('Select ticket type...')
            .addOptions(types.slice(0, 25).map(t => ({ label: `${t.emoji} ${t.name}`, value: t._id.toString(), description: t.description })))
        ));
      }

      await interaction.reply({ content: '✅ Ticket panel posted.', ephemeral: true });
      await interaction.channel.send({ content: text, components: rows });
    }
  },
};

async function handleTicketOpen(interaction, typeId) {
  const { guild, user } = interaction;
  const type = await TicketType.findById(typeId).catch(() => null);
  if (!type) return interaction.reply({ content: '❌ Ticket type not found.', ephemeral: true });

  const cfg = await GuildConfig.findOne({ guildId: guild.id });
  const channelName = `${type.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`.slice(0, 100);

  const existing = guild.channels.cache.find(c => c.name === channelName);
  if (existing) return interaction.reply({ content: `❌ You already have an open ticket: <#${existing.id}>`, ephemeral: true });

  const staffRoles = [...(type.staffRoles || []), ...(cfg?.prStaffRoles || [])];
  const permissionOverwrites = [
    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    ...staffRoles.map(r => ({ id: r, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] })),
  ];

  const ticketChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: cfg?.ticketCategory || null,
    permissionOverwrites,
  });

  const pingText = staffRoles.map(r => `<@&${r}>`).join(' ');
  let msg =
    `## ${type.emoji} ${type.name}\n` +
    `-# Roastin Coffee Ticket System\n\n` +
    `Welcome, <@${user.id}>! A staff member will be with you shortly.\n\n` +
    `### 📋 Please answer the following:\n`;

  type.questions.forEach((q, i) => { msg += `\n**${i + 1}.** ${q}`; });

  await ticketChannel.send({ content: `${pingText ? pingText + ' ' : ''}<@${user.id}>` });
  await ticketChannel.send({ content: msg });

  return interaction.reply({ content: `✅ Your ticket has been created: <#${ticketChannel.id}>`, ephemeral: true });
}

module.exports.handleTicketOpen = handleTicketOpen;
