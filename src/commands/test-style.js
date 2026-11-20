const { SlashCommandBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const {
  card, successCard, errorCard, warningCard, infoCard,
  partnerCard, partnerInfoCard,
  infractionCard, ticketWelcomeCard, reviewCard, reviewResultCard,
  eventRequestCard, eventAnnouncementCard, logCard,
} = require('../ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test-style')
    .setDescription('Preview all card styles from the design system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const fakePartner = {
      _id: '000000000000000000000000',
      name: 'Example Café',
      robloxLink: 'https://www.roblox.com/groups/1',
      discordInvite: 'https://discord.gg/example',
      representativeId: interaction.user.id,
      addedAt: new Date(),
      status: 'active',
    };

    const fakeInfraction = {
      _id: '000000000000000000000001',
      type: 'strike',
      reason: 'Example violation',
      issuedBy: interaction.user.id,
      issuedAt: new Date(),
    };

    const fakeType = {
      emoji: '🎫',
      name: 'General Question',
      welcomeText: 'Welcome to your ticket! Please wait for staff.',
      questions: ['What do you need help with?', 'Which group are you from?'],
    };

    const fakeReq = {
      _id: '000000000000000000000002',
      title: 'Community Event',
      type: 'Event',
      date: 'December 20, 2026',
      description: 'Join us for a community meetup!',
      submitterId: interaction.user.id,
      startsAt: new Date('2026-12-20T15:00:00Z'),
    };

    const cards = [
      successCard('This is a success card.'),
      errorCard('This is an error card.'),
      warningCard('This is a warning card.'),
      infoCard('Info Title', 'This is an info card.'),
      partnerCard(fakePartner),
      infractionCard(fakeInfraction, fakePartner, interaction.user.id, 2, 3),
      ticketWelcomeCard(fakeType, { id: interaction.user.id, username: 'TestUser' }),
      reviewCard(fakePartner, 'December 2026', 'Please complete your review.', 'link', 'https://example.com/review'),
      reviewResultCard(fakePartner, ['Active', 'Yes, hosted one', 'No issues'], ['How active?', 'Events?', 'Issues?'], interaction.user.id),
      eventRequestCard(fakeReq, interaction.user.id),
      eventAnnouncementCard(fakeReq),
      logCard('Test Log Entry', 'This is a log card example.'),
    ];

    for (const c of cards) {
      await interaction.channel.send(c).catch(() => {});
      await new Promise(r => setTimeout(r, 700));
    }

    await interaction.editReply(successCard('Design preview sent to this channel.'));
  },
};
