'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner-note')
    .setDescription('Partner-Notizen verwalten.')
    .addSubcommand(s => s.setName('add').setDescription('Notiz hinzufügen.')
      .addStringOption(o => o.setName('partner').setDescription('Partner').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('text').setDescription('Notiz').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('Notizen anzeigen.')
      .addStringOption(o => o.setName('partner').setDescription('Partner').setRequired(true).setAutocomplete(true))),
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

    const name = interaction.options.getString('partner');
    const partner = await Partner.findOne({ guildId, name });
    if (!partner) return interaction.editReply(errorCard('Partner nicht gefunden.'));

    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      const text = interaction.options.getString('text');
      if (!partner.notes) partner.notes = [];
      partner.notes.push({ text, authorId: interaction.user.id, createdAt: new Date() });
      await partner.save();
      await require('../utils/audit').audit(guildId, interaction.user.id, 'partner_note_add', 'partner', partner._id.toString());
      return interaction.editReply(successCard('Notiz hinzugefügt.'));
    }

    if (sub === 'list') {
      const notes = partner.notes || [];
      if (!notes.length) return interaction.editReply(errorCard('Keine Notizen.'));
      const desc = notes.map(n => `> ${n.text}\n-# <@${n.authorId}> · ${n.createdAt?.toISOString() || ''}`).join('\n\n');
      return interaction.editReply(successCard(desc));
    }
  },
};
