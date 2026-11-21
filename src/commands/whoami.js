'use strict';
const { SlashCommandBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { isStaff, isAdmin, getLevel } = require('../utils/permissions');
const { successCard, errorCard } = require('../ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whoami')
    .setDescription('Zeigt deine Berechtigungsstufe und nutzbare Befehle.'),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
    const level = getLevel(interaction.member, cfg);
    const labels = { 0: 'PUBLIC', 1: 'PARTNER_REP', 2: 'STAFF', 3: 'ADMIN' };
    const cmds = {
      0: ['/ticket (open)', '/event-request (if allowed)'],
      1: ['+ /partner info', '+ /partner list'],
      2: ['+ /partner add/edit/remove', '+ /infraction', '+ /review', '+ /ticket setup/edit/info/add/remove/rename/priority/close-request/transfer/note', '+ /stats', '+ /audit', '+ /doctor'],
      3: ['+ /config', '+ /dweeb', '+ /export', '+ /test-style', '+ /setup'],
    };
    let desc = `**Level:** ${labels[level]} (${level})\n\n**Available commands:**\n`;
    for (let i = 0; i <= level; i++) desc += cmds[i].join('\n') + '\n';
    await interaction.editReply(successCard(desc));
  },
};
