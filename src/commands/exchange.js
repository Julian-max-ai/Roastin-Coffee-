'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('exchange')
    .setDescription('Partnership-Austausch tracken.')
    .addSubcommand(s => s.setName('log').setDescription('Austausch protokollieren.')
      .addStringOption(o => o.setName('partner').setDescription('Partner').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('type').setDescription('Typ').setRequired(true).addChoices(
        { name: 'Werbung', value: 'ad' }, { name: 'Shoutout', value: 'shoutout' }, { name: 'Event', value: 'event' }))
      .addStringOption(o => o.setName('link').setDescription('Link/Screenshot').setRequired(false)))
    .addSubcommand(s => s.setName('due').setDescription('Partner ohne Austausch anzeigen.')),
  async autocomplete(interaction) {
    const partners = await Partner.find({ guildId: interaction.guildId, status: 'active' });
    const focused = interaction.options.getFocused().toLowerCase();
    await interaction.respond(partners.filter(p => p.name.toLowerCase().includes(focused)).slice(0, 25).map(p => ({ name: p.name, value: p.name })));
  },
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const cfg = await require('../models/GuildConfig').findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Nur Staff.'));

    const sub = interaction.options.getSubcommand();
    if (sub === 'log') {
      const name = interaction.options.getString('partner');
      const partner = await Partner.findOne({ guildId, name });
      if (!partner) return interaction.editReply(errorCard('Partner nicht gefunden.'));
      if (!partner.exchanges) partner.exchanges = [];
      partner.exchanges.push({ type: interaction.options.getString('type'), link: interaction.options.getString('link'), date: new Date(), by: interaction.user.id });
      await partner.save();
      return interaction.editReply(successCard(`Austausch für **${name}** protokolliert.`));
    }

    if (sub === 'due') {
      const partners = await Partner.find({ guildId, status: 'active' });
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const due = partners.filter(p => {
        const last = (p.exchanges || []).sort((a, b) => b.date - a.date)[0];
        return !last || last.date < thirtyDaysAgo;
      });
      if (!due.length) return interaction.editReply(successCard('Alle Partner haben kürzlich Austausch gehabt.'));
      const desc = due.map(p => `• **${p.name}**`).join('\n');
      return interaction.editReply(successCard(`Partner ohne Austausch (>30 Tage):\\n${desc}`));
    }
  },
};
