'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { successCard } = require('../ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available commands and help.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const desc = `**Roastin' Coffee PR-Bot — Help**\n\n` +
      `Use \`/setup start\` for guided setup.\n` +
      `Use \`/whoami\` to see your permission level.\n` +
      `Use \`/config\` for server configuration.\n` +
      `Use \`/doctor\` for system diagnostics.\n\n` +
      `**Commands:**\n` +
      `• \`/ticket\` — Ticket-Management\n` +
      `• \`/partner\` — Partner-Management\n` +
      `• \`/infraction\` — Infraktionen\n` +
      `• \`/review\` — Monatliche Reviews\n` +
      `• \`/event-request\` — Event Requests\n` +
      `• \`/stats\` — Statistiken\n` +
      `• \`/audit\` — Audit-Log\n` +
      `• \`/export\` — Daten-Export\n` +
      `• \`/macro\` — Textbausteine\n` +
      `• \`/dashboard\` — Staff-Dashboard\n`;
    await interaction.editReply(successCard(desc));
  },
};
