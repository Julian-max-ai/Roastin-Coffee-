'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard, infoCard } = require('../ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Guided bot setup.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('start').setDescription('Startet oder setzt den Setup-Assistenten fort.'))
    .addSubcommand(s => s.setName('status').setDescription('Zeigt den Setup-Fortschritt.'))
    .addSubcommand(s => s.setName('test').setDescription('Run setup validation tests.'))
    .addSubcommand(s => s.setName('help').setDescription('Explanations for a topic.')
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
          { name: 'Dweeb', value: 'dweeb' },
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
        desc += `${done ? '✅' : '⬜'} ${step}\n`;
      }
      desc += '\nUse `/setup help topic:<name>` for detailed explanations.\nMark steps complete via /config.';
      await interaction.editReply(infoCard('Setup', desc, true));
    }

    if (sub === 'test') {
      const checks = [];
      if (cfg?.announcementChannel) checks.push('✅ Announcement channel set');
      else checks.push('❌ Announcement channel missing');
      if (cfg?.reviewChannel) checks.push('✅ Review channel set');
      else checks.push('❌ Review channel missing');
      if (cfg?.logChannel) checks.push('✅ Log channel set');
      else checks.push('❌ Log channel missing');
      if (cfg?.ticketCategory) checks.push('✅ Ticket category set');
      else checks.push('❌ Ticket category missing');
      if (cfg?.prStaffRoles?.length) checks.push('✅ PR staff roles set');
      else checks.push('❌ PR staff roles missing');
      await interaction.editReply(successCard(checks.join('\n')));
      return;
    }

    if (sub === 'help') {
      const topic = interaction.options.getString('topic');
      const helpTexts = {
        rights: 'Rights: 4 levels (PUBLIC, PARTNER_REP, STAFF, ADMIN). Configure under /config → Rights. Admin roles get full access, PR staff manage partners/tickets, partner reps manage their own partner.',
        channels: 'Channels: Log (audit/infraction logs), Transcript (ticket transcripts), Review (monthly reviews), Announcement (PR posts), Partner List (partner overview), Event (event requests). Configure under /config → Channels.',
        tickets: 'Tickets: Category for ticket channels, types with custom welcome text/questions/staff roles, claim renaming, auto-close after inactivity. Configure under /config → Tickets. Use /ticket setup to configure types.',
        partners: 'Partners: Each partner gets their own channel. Multiple reps per partner. Use /partner add to create. Channel auto-created if configured.',
        reviews: 'Reviews: Monthly review cycle. Configure questions under /review-questions. Reviews sent on configured day. Configure under /config → Reviews.',
        infractions: 'Infractions: Warning/Strike/Termination. Strikes expire after configured days. Escalation card posted when strike limit reached. Appeals via button. Configure under /config → Infractions.',
        events: 'Events: Request/approve/deny flow with reminders. Approved events posted to announcement channel. Configure under /config → Events.',
        automation: 'Automation: Inactivity reminders, auto-close, SLA alerts, pending renames. Configure under /config → Automation.',
        dweeb: 'Dweeb: A dweeb is a lightweight bot helper that handles background tasks like message tracking and auto-responses. No configuration needed — runs automatically.',
      };
      await interaction.editReply(infoCard(`Setup Help: ${topic}`, helpTexts[topic] || 'No help available.', true));
    }
  },
};
