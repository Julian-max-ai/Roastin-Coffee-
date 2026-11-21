'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');
const { syncTicketChannel } = require('../utils/ticketNaming');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-transfer')
    .setDescription('Ticket an anderen Staff übergeben.')
    .addUserOption(o => o.setName('user').setDescription('Neuer Claimer').setRequired(true)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, channel } = interaction;
    const cfg = await GuildConfig.findOne({ guildId: guild.id });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Nur Staff.'));

    const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });
    if (!ticket) return interaction.editReply(errorCard('Kein offenes Ticket.'));

    const newUser = interaction.options.getUser('user');
    await Ticket.findByIdAndUpdate(ticket._id, { claimedBy: newUser.id });
    const updated = await Ticket.findById(ticket._id);

    // Sync channel name
    const typeKey = ticket.typeId || 'general';
    await syncTicketChannel(channel, updated, typeKey).catch(() => {});

    await require('../utils/audit').audit(guild.id, interaction.user.id, 'ticket_transfer', 'ticket', ticket._id.toString(), { from: ticket.claimedBy, to: newUser.id });
    await interaction.editReply(successCard(`Ticket an <@${newUser.id}> übergeben.`));
  },
};
