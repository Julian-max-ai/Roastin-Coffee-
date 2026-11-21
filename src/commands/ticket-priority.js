'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');
const { syncTicketChannel } = require('../utils/ticketNaming');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-priority')
    .setDescription('Set ticket priority.')
    .addStringOption(o => o.setName('priority').setDescription('Priority').setRequired(true)
      .addChoices({ name: 'low', value: 'low' }, { name: 'normal', value: 'normal' }, { name: 'high', value: 'high' }, { name: 'urgent', value: 'urgent' })),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, channel } = interaction;
    const cfg = await GuildConfig.findOne({ guildId: guild.id });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });
    if (!ticket) return interaction.editReply(errorCard('No open ticket.'));

    const priority = interaction.options.getString('priority');
    ticket.priority = priority;
    await ticket.save();

    const typeKey = ticket.typeId || 'general';
    await syncTicketChannel(channel, ticket, typeKey).catch(() => {});

    await require('../utils/audit').audit(guild.id, interaction.user.id, 'ticket_priority', 'ticket', ticket._id.toString(), { priority });
    await interaction.editReply(successCard(`Priority set to **${priority}** set.`));
  },
};
