'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Infraction = require('../models/Infraction');
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');
const { infractionListCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

function queryInfractions(partnerId, guildId, filter) {
  const q = { guildId, partnerId };
  if (filter === 'active') { q.removed = false; q.expired = false; }
  else if (filter === 'removed') { q.removed = true; }
  else if (filter === 'expired') { q.expired = true; }
  return Infraction.find(q).sort({ issuedAt: -1 });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction-list')
    .setDescription('Infractions eines Partners anzeigen.')
    .addStringOption(o => o.setName('partner').setDescription('Partner').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('filter').setDescription('Filter').addChoices(
      { name: 'Active', value: 'active' }, { name: 'All', value: 'all' },
      { name: 'Removed', value: 'removed' }, { name: 'Expired', value: 'expired' })),
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

    const filter = interaction.options.getString('filter') || 'active';
    const infractions = await queryInfractions(partner._id.toString(), guildId, filter);
    const strikes = infractions.filter(i => i.type === 'strike' && !i.removed && !i.expired).length;
    const { STRIKE_LIMIT } = require('../theme');
    const card = infractionListCard(partner, infractions.slice(0, 10), 0, Math.ceil(infractions.length / 10), strikes, STRIKE_LIMIT, filter);
    await interaction.editReply(card);
  },
};
