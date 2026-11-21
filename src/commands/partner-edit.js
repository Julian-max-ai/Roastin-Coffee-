'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner-edit')
    .setDescription('Partner bearbeiten.')
    .addStringOption(o => o.setName('name').setDescription('Partner-Name').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('newname').setDescription('Neuer Name'))
    .addStringOption(o => o.setName('roblox').setDescription('Neuer Roblox-Link'))
    .addStringOption(o => o.setName('discord').setDescription('Neuer Discord-Invite'))
    .addStringOption(o => o.setName('status').setDescription('Status').addChoices(
      { name: 'active', value: 'active' }, { name: 'probation', value: 'probation' }, { name: 'inactive', value: 'inactive' }))
    .addChannelOption(o => o.setName('channel').setDescription('Partner-Channel')),
  async autocomplete(interaction) {
    const partners = await Partner.find({ guildId: interaction.guildId });
    const focused = interaction.options.getFocused().toLowerCase();
    await interaction.respond(partners.filter(p => p.name.toLowerCase().includes(focused)).slice(0, 25).map(p => ({ name: p.name, value: p.name })));
  },
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Nur Staff.'));

    const name = interaction.options.getString('name');
    const partner = await Partner.findOne({ guildId, name });
    if (!partner) return interaction.editReply(errorCard('Partner nicht gefunden.'));

    const changes = [];
    if (interaction.options.getString('newname')) { partner.name = interaction.options.getString('newname'); changes.push('Name'); }
    if (interaction.options.getString('roblox')) { partner.robloxLink = interaction.options.getString('roblox'); changes.push('Roblox'); }
    if (interaction.options.getString('discord')) { partner.discordInvite = interaction.options.getString('discord'); changes.push('Discord'); }
    if (interaction.options.getString('status')) { partner.status = interaction.options.getString('status'); changes.push('Status'); }
    if (interaction.options.getChannel('channel')) { partner.channelId = interaction.options.getChannel('channel').id; changes.push('Channel'); }

    await partner.save();
    await require('../utils/audit').audit(guildId, interaction.user.id, 'partner_edit', 'partner', partner._id.toString(), { changes });
    await interaction.editReply(successCard(`**${name}** aktualisiert: ${changes.join(', ')}`));
  },
};
