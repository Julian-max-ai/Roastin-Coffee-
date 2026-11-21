'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');
const { createPartnerChannel } = require('../utils/partnerChannelCreate');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner-rep')
    .setDescription('Partner-Repräsentanten verwalten.')
    .addSubcommand(s => s.setName('add').setDescription('Rep hinzufügen.')
      .addStringOption(o => o.setName('partner').setDescription('Partner').setRequired(true).setAutocomplete(true))
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('remove').setDescription('Rep entfernen.')
      .addStringOption(o => o.setName('partner').setDescription('Partner').setRequired(true).setAutocomplete(true))
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),
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

    const user = interaction.options.getUser('user');
    if (!partner.representativeIds) partner.representativeIds = [];
    if (partner.representativeId && !partner.representativeIds.includes(partner.representativeId)) {
      partner.representativeIds.push(partner.representativeId);
    }

    const sub = interaction.options.getSubcommand();
    if (sub === 'add') {
      if (partner.representativeIds.includes(user.id)) return interaction.editReply(errorCard('User ist bereits Rep.'));
      partner.representativeIds.push(user.id);
      await partner.save();
      // Auto-assign role
      if (cfg?.autoAssignRepRoles && cfg?.partnerRepRoles?.length) {
        try {
          const member = await interaction.guild.members.fetch(user.id);
          await member.roles.add(cfg.partnerRepRoles);
        } catch {}
      }
      await require('../utils/audit').audit(guildId, interaction.user.id, 'partner_rep_add', 'partner', partner._id.toString(), { userId: user.id });
      return interaction.editReply(successCard(`**${user.tag}** als Rep von **${name}** hinzugefügt.`));
    }

    if (sub === 'remove') {
      if (partner.representativeIds.length <= 1) return interaction.editReply(errorCard('Mindestens ein Rep muss bleiben.'));
      partner.representativeIds = partner.representativeIds.filter(id => id !== user.id);
      if (partner.representativeId === user.id) partner.representativeId = partner.representativeIds[0];
      await partner.save();
      await require('../utils/audit').audit(guildId, interaction.user.id, 'partner_rep_remove', 'partner', partner._id.toString(), { userId: user.id });
      return interaction.editReply(successCard(`**${user.tag}** als Rep von **${name}** entfernt.`));
    }
  },
};
