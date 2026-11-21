'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-note')
    .setDescription('Add internal note to a ticket.')
    .addStringOption(o => o.setName('text').setDescription('Note').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, channel } = interaction;
    const cfg = await require('../models/GuildConfig').findOne({ guildId: guild.id });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });
    if (!ticket) return interaction.editReply(errorCard('No open ticket in this channel.'));

    if (!ticket.notes) ticket.notes = [];
    ticket.notes.push({ text: interaction.options.getString('text'), authorId: interaction.user.id, createdAt: new Date() });
    await ticket.save();

    await require('../utils/audit').audit(guild.id, interaction.user.id, 'ticket_note', 'ticket', ticket._id.toString(), { text: interaction.options.getString('text').slice(0, 100) });
    await interaction.editReply(successCard('Note added.'));
  },
};
