'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const AuditEntry = require('../models/AuditEntry');
const { auditCard, errorCard } = require('../ui');
const { ts } = require('../utils/format');
const { PAGE_SIZE } = require('../theme');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('audit')
    .setDescription('View the audit log.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('action').setDescription('Filter by action name').setRequired(false)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const actionFilter = interaction.options.getString('action');

    const query = { guildId };
    if (actionFilter) query.action = actionFilter;

    const entries = await AuditEntry.find(query).sort({ createdAt: -1 }).limit(PAGE_SIZE * 2);
    const page = 0;
    const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
    const items = entries.slice(0, PAGE_SIZE);

    const res = auditCard(items, page, totalPages);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('audit_next:0').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1),
    );
    res.components = [...res.components, row];
    await interaction.editReply(res);
  },
};

module.exports.handleAuditPagination = async (interaction, dir) => {
  const { guildId } = interaction;
  const parts = interaction.customId.split(':');
  const page = parseInt(parts[1], 10);
  const next = dir === 'next' ? page + 1 : page - 1;

  const entries = await AuditEntry.find({ guildId }).sort({ createdAt: -1 }).limit(PAGE_SIZE * 5);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.max(0, Math.min(next, totalPages - 1));
  const items = entries.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const res = auditCard(items, safePage, totalPages);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`audit_prev:${safePage}`).setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(safePage === 0),
    new ButtonBuilder().setCustomId(`audit_next:${safePage}`).setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(safePage >= totalPages - 1),
  );
  res.components = [...res.components, row];
  await interaction.update(res);
};
