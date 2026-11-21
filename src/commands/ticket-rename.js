'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');
const { syncTicketChannel } = require('../utils/ticketNaming');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-rename')
    .setDescription('Rename ticket base name.')
    .addStringOption(o => o.setName('name').setDescription('Neuer Basisname').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, channel } = interaction;
    const cfg = await GuildConfig.findOne({ guildId: guild.id });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });
    if (!ticket) return interaction.editReply(errorCard('No open ticket.'));

    const newName = interaction.options.getString('name').toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 30);
    ticket.baseName = newName;
    await ticket.save();

    const typeKey = ticket.typeId || 'general';
    await syncTicketChannel(channel, ticket, typeKey).catch(() => {});

    await require('../utils/audit').audit(guild.id, interaction.user.id, 'ticket_rename', 'ticket', ticket._id.toString(), { newName });
    await interaction.editReply(successCard(`Ticket renamed to **${newName}**.`));
  },
};
