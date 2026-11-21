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
    .setName('partner-info')
    .setDescription('Show partner information.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('name').setDescription('Partner').setRequired(true).setAutocomplete(true)),
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

    const name = interaction.options.getString('name');
    const partner = await Partner.findOne({ guildId, name });
    if (!partner) return interaction.editReply(errorCard('Partner not found.'));

    const reps = partner.representativeIds?.length ? partner.representativeIds : [partner.representativeId];
    const activeStrikes = await Infraction.countDocuments({ guildId, partnerId: partner._id.toString(), type: 'strike', removed: false, expired: false });
    const tickets = await Ticket.countDocuments({ guildId, userId: partner.representativeId });

    let desc = `**${partner.name}**\n`;
    desc += `Status: ${partner.status}\n`;
    desc += `Channel: ${partner.channelId ? `<#${partner.channelId}>` : 'No channel'}\n`;
    desc += `Reps: ${reps.map(r => `<@${r}>`).join(', ')}\n`;
    desc += `Seit: ${partner.addedAt?.toISOString()?.slice(0, 10) || 'n/a'}\n`;
    desc += `Strikes: ${activeStrikes}\n`;
    desc += `Tickets: ${tickets}\n`;
    desc += `Noteen: ${(partner.notes || []).length}\n`;
    if (partner.channelMissing) desc += `⚠️ Channel missing!\n`;

    await interaction.editReply(successCard(desc));
  },
};
