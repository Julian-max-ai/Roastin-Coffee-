'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard, infoCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

const SETUP_STEPS = [
  { id: 'welcome', title: 'Welcome & Requirements', required: true,
    why: 'This bot manages partner reviews, tickets, infractions, and events for your PR team.',
    how: 'Check that the bot has the required permissions. Fix any issues shown below.' },
  { id: 'roles', title: 'Roles', required: true,
    why: 'Admin, PR Staff, and Partner Representative roles control who can do what.',
    how: 'Select existing roles or create new ones. Admin: full access. Staff: partners/tickets. Rep: reviews/events.' },
  { id: 'channels', title: 'Channels', required: true,
    why: 'Log, transcript, review, announcement, and partner list channels are needed for the bot to function.',
    how: 'Select existing channels or create them. The bot will set permissions automatically.' },
  { id: 'tickets', title: 'Tickets', required: true,
    why: 'Ticket system for support, partnerships, and reports.',
    how: 'Create a ticket category and initialize ticket types. Toggle auto-close and ratings.' },
  { id: 'dweeb', title: 'Ticket Panel (dweeb)', required: false,
    why: 'dweeb.faizo.net is an online Discord message designer (not part of this bot).',
    how: '1. Open dweeb.faizo.net and design your panel. 2. Add 3 buttons with Custom-IDs: ticket_open:general, ticket_open:partnership, ticket_open:report. 3. Copy the result. 4. Run /dweeb send in your panel channel and paste. 5. Test by clicking a button.' },
  { id: 'partners', title: 'Partners & Reviews', required: false,
    why: 'Each partner gets their own channel. Reviews are sent monthly.',
    how: 'Set partner category, auto-assign rep roles, review send day, and mode (form/link).' },
  { id: 'infractions', title: 'Infractions & Events', required: false,
    why: 'Strike system and event request flow.',
    how: 'Set strike limit, expiry days, event channel, and who can request events.' },
  { id: 'finish', title: 'Finish', required: true,
    why: 'Review your setup and start using the bot.',
    how: 'Check all items are green. Use /config for further adjustments.' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Guided bot setup wizard.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s => s.setName('start').setDescription('Start or continue the setup wizard.'))
    .addSubcommand(s => s.setName('status').setDescription('Show setup progress.')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId, guild } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      const lines = SETUP_STEPS.map(s => {
        const done = s.id === 'finish' ? true : checkStatus(s.id, cfg);
        return `${done ? '✅' : '⚠️'} **${s.title}**${s.required ? '' : ' (optional)'}`;
      });
      await interaction.editReply(infoCard('Setup Progress', lines.join('\n'), true));
      return;
    }

    // start
    const stepIdx = findNextStep(cfg);
    const step = SETUP_STEPS[stepIdx];
    const status = step.id === 'finish' ? '✅' : (checkStatus(step.id, cfg) ? '✅' : '⚠️');
    const desc = `**Step ${stepIdx + 1}/${SETUP_STEPS.length}: ${step.title}** ${status}\n\n` +
      `**What is this for?**\n${step.why}\n\n` +
      `**What you need to do:**\n${step.how}\n\n` +
      `Use the buttons below to navigate.`;

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`setup:${step.id}:back`).setLabel('◀ Back').setStyle(ButtonStyle.Secondary).setDisabled(stepIdx === 0),
      new ButtonBuilder().setCustomId(`setup:${step.id}:next`).setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(stepIdx === SETUP_STEPS.length - 1),
      new ButtonBuilder().setCustomId(`setup:${step.id}:skip`).setLabel('Skip').setStyle(ButtonStyle.Secondary),
    );
    await interaction.editReply({ ...infoCard('Setup Wizard', desc, true), components: [row] });
  },
};

function checkStatus(id, cfg) {
  if (!cfg) return false;
  switch (id) {
    case 'welcome': return cfg.prStaffRoles?.length > 0;
    case 'roles': return cfg.adminRoles?.length > 0 && cfg.prStaffRoles?.length > 0;
    case 'channels': return cfg.logChannel && cfg.reviewChannel;
    case 'tickets': return cfg.ticketCategory;
    case 'dweeb': return true; // manual step
    case 'partners': return true; // optional
    case 'infractions': return true; // optional
    default: return true;
  }
}

function findNextStep(cfg) {
  for (let i = 0; i < SETUP_STEPS.length; i++) {
    if (!checkStatus(SETUP_STEPS[i].id, cfg) && SETUP_STEPS[i].required) return i;
  }
  return SETUP_STEPS.length - 1;
}
