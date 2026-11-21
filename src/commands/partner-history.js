'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const Infraction = require('../models/Infraction');
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner-history')
    .setDescription('Show partner history.')
    .addStringOption(o => o.setName('partner').setDescription('Partner').setRequired(true).setAutocomplete(true)),
  async autocomplete(interaction) {
    const partners = await Partner.find({ guildId: interaction.guildId });
    const focused = interaction.options.getFocused().toLowerCase();
    await interaction.respond(partners.filter(p => p.name.toLowerCase().includes(focused)).slice(0, 25).map(p => ({ name: p.name, value: p.name })));
  },
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const name = interaction.options.getString('partner');
    const partner = await Partner.findOne({ guildId, name });
    if (!partner) return interaction.editReply(errorCard('Partner not found.'));

    const infractions = await Infraction.find({ guildId, partnerId: partner._id.toString() }).sort({ createdAt: -1 }).limit(5);
    const tickets = await Ticket.find({ guildId, userId: partner.representativeId }).sort({ openedAt: -1 }).limit(5);

    let desc = `**Partner: ${partner.name}**\nStatus: ${partner.status}\nSeit: ${partner.addedAt?.toISOString() || 'n/a'}\n\n`;
    desc += `**Infractions (${infractions.length}):**\n`;
    for (const inf of infractions) desc += `> ${inf.type} — ${inf.reason} (${inf.issuedAt?.toISOString()?.slice(0, 10) || ''})\n`;
    desc += `\n**Tickets (${tickets.length}):**\n`;
    for (const t of tickets) desc += `> #${t.ticketNumber || '?'} — ${t.status} (${t.openedAt?.toISOString()?.slice(0, 10) || ''})\n`;
    desc += `\n**Noteen:** ${(partner.notes || []).length}`;

    await interaction.editReply(successCard(desc));
  },
};
