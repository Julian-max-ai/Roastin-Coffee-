'use strict';
const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const Partner = require('../models/Partner');
const Infraction = require('../models/Infraction');
const Ticket = require('../models/Ticket');
const { errorCard, successCard } = require('../ui');

function toCSV(rows) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const line = (vals) => headers.map(h => {
    const v = vals[h] == null ? '' : String(vals[h]);
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  }).join(',');
  return [headers.join(','), ...rows.map(r => line(r))].join('\n');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('export')
    .setDescription('Export data as CSV.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('type').setDescription('What to export').setRequired(true)
      .addChoices(
        { name: 'Partners', value: 'partners' },
        { name: 'Infractions', value: 'infractions' },
        { name: 'Tickets', value: 'tickets' },
      )),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId } = interaction;
    const type = interaction.options.getString('type');

    let rows, filename;
    if (type === 'partners') {
      rows = await Partner.find({ guildId }).lean();
      rows = rows.map(r => ({ name: r.name, robloxLink: r.robloxLink, discordInvite: r.discordInvite, representativeId: r.representativeId, status: r.status, addedAt: r.addedAt }));
      filename = 'partners.csv';
    } else if (type === 'infractions') {
      rows = await Infraction.find({ guildId }).lean();
      rows = rows.map(r => ({ partnerId: r.partnerId, type: r.type, reason: r.reason, issuedBy: r.issuedBy, issuedAt: r.issuedAt, removed: r.removed }));
      filename = 'infractions.csv';
    } else {
      rows = await Ticket.find({ guildId }).lean();
      rows = rows.map(r => ({ channelId: r.channelId, userId: r.userId, typeId: r.typeId, claimedBy: r.claimedBy, status: r.status, priority: r.priority, openedAt: r.openedAt, closedAt: r.closedAt, rating: r.rating }));
      filename = 'tickets.csv';
    }

    const csv = toCSV(rows);
    const attachment = new AttachmentBuilder(Buffer.from(csv, 'utf-8'), { name: filename });
    await interaction.editReply({ ...successCard(`Exported ${rows.length} ${type}.`), files: [attachment] });
  },
};
