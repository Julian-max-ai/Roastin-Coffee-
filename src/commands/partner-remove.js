'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner-remove')
    .setDescription('Partner entfernen (Soft-Delete).')
    .addStringOption(o => o.setName('name').setDescription('Partner').setRequired(true).setAutocomplete(true))
    .addBooleanOption(o => o.setName('delete-channel').setDescription('Channel löschen?')),
  async autocomplete(interaction) {
    const partners = await Partner.find({ guildId: interaction.guildId, status: { $ne: 'removed' } });
    const focused = interaction.options.getFocused().toLowerCase();
    await interaction.respond(partners.filter(p => p.name.toLowerCase().includes(focused)).slice(0, 25).map(p => ({ name: p.name, value: p.name })));
  },
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId, guild } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Nur Staff.'));

    const name = interaction.options.getString('name');
    const partner = await Partner.findOne({ guildId, name, status: { $ne: 'removed' } });
    if (!partner) return interaction.editReply(errorCard('Partner nicht gefunden.'));

    partner.status = 'removed';
    await partner.save();

    if (interaction.options.getBoolean('delete-channel') && partner.channelId) {
      const ch = await guild.channels.fetch(partner.channelId).catch(() => null);
      if (ch) await ch.delete().catch(() => {});
    }

    await require('../utils/audit').audit(guildId, interaction.user.id, 'partner_remove', 'partner', partner._id.toString(), { name });
    await interaction.editReply(successCard(`**${name}** wurde entfernt (Soft-Delete).`));
  },
};
