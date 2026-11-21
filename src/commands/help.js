'use strict';
const { SlashCommandBuilder } = require('discord.js');
const { successCard } = require('../ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Zeigt verfügbare Befehle und Hilfe.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const desc = `**Roastin' Coffee PR-Bot — Hilfe**\n\n` +
      `Nutze \`/setup start\` für die geführte Einrichtung.\n` +
      `Nutze \`/whoami\` um deine Berechtigungsstufe zu sehen.\n` +
      `Nutze \`/config\` für die Server-Konfiguration.\n` +
      `Nutze \`/doctor\` für eine Systemdiagnose.\n\n` +
      `**Befehle:**\n` +
      `• \`/ticket\` — Ticket-Management\n` +
      `• \`/partner\` — Partner-Management\n` +
      `• \`/infraction\` — Infraktionen\n` +
      `• \`/review\` — Monatliche Reviews\n` +
      `• \`/event-request\` — Event-Anfragen\n` +
      `• \`/stats\` — Statistiken\n` +
      `• \`/audit\` — Audit-Log\n` +
      `• \`/export\` — Daten-Export\n` +
      `• \`/macro\` — Textbausteine\n` +
      `• \`/dashboard\` — Staff-Dashboard\n`;
    await interaction.editReply(successCard(desc));
  },
};
