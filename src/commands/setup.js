'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard, infoCard } = require('../ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Geführte Einrichtung des Bots.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('start').setDescription('Startet oder setzt den Setup-Assistenten fort.'))
    .addSubcommand(s => s.setName('status').setDescription('Zeigt den Setup-Fortschritt.'))
    .addSubcommand(s => s.setName('help').setDescription('Erklärungen zu einem Thema.')
      .addStringOption(o => o.setName('topic').setDescription('Thema').setRequired(true)
        .addChoices(
          { name: 'Rechte', value: 'rights' },
          { name: 'Channels', value: 'channels' },
          { name: 'Tickets', value: 'tickets' },
          { name: 'Partner', value: 'partners' },
          { name: 'Reviews', value: 'reviews' },
          { name: 'Infraktionen', value: 'infractions' },
          { name: 'Events', value: 'events' },
          { name: 'Automation', value: 'automation' },
        ))),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const sub = interaction.options.getSubcommand();
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });

    if (sub === 'start' || sub === 'status') {
      const progress = cfg?.setupProgress || {};
      const steps = ['rights', 'channels', 'tickets', 'partners', 'reviews', 'infractions', 'events', 'automation'];
      let desc = '**Setup-Fortschritt:**\n\n';
      for (const step of steps) {
        const done = progress[step] === true;
        desc += `${done ? '✅' : '⚠️'} ${step}\n`;
      }
      desc += '\nNutze `/setup help topic:<name>` für Erklärungen.';
      await interaction.editReply(infoCard('Setup', desc, true));
    }

    if (sub === 'help') {
      const topic = interaction.options.getString('topic');
      const helpTexts = {
        rights: 'Rechte: 4 Stufen (PUBLIC, PARTNER_REP, STAFF, ADMIN). Konfiguriere unter /config → Rechte.',
        channels: 'Channels: Log, Transcript, Review, Announcement, Partner-Liste, Event. Konfiguriere unter /config → Channels.',
        tickets: 'Tickets: Kategorie, Typen, Claim-Umbenennung, Auto-Close. Konfiguriere unter /config → Tickets.',
        partners: 'Partner: Eigener Channel pro Partner, mehrere Reps. /partner add.',
        reviews: 'Reviews: Monatlicher Ablauf, Fragen, Versandtag. /config → Reviews.',
        infractions: 'Infraktionen: Warning/Strike/Termination, Ablaufzeiten. /config → Infraktionen.',
        events: 'Events: Anfragen, Genehmigung, Reminder. /config → Events.',
        automation: 'Automation: Inaktivität, Auto-Close, Reminder. /config → Automation.',
      };
      await interaction.editReply(infoCard(`Setup Help: ${topic}`, helpTexts[topic] || 'Keine Hilfe verfügbar.', true));
    }
  },
};
