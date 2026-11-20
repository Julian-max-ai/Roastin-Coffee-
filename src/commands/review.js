const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const Partner = require('../models/Partner');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Monthly partnership review system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('send')
      .setDescription('Manually send the monthly partnership review.')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await sendMonthlyReviews(interaction.client, interaction.guildId);
    await interaction.editReply({ content: '✅ Monthly review sent.' });
  },
};

async function sendMonthlyReviews(client, targetGuildId = null) {
  const query = targetGuildId ? { guildId: targetGuildId } : {};
  const configs = await GuildConfig.find(targetGuildId ? query : {});

  for (const cfg of configs) {
    if (!cfg.reviewChannel) continue;
    const partners = await Partner.find({ guildId: cfg.guildId });
    if (!partners.length) continue;

    const channel = await client.channels.fetch(cfg.reviewChannel).catch(() => null);
    if (!channel) continue;

    const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    for (const partner of partners) {
      const embed = new EmbedBuilder()
        .setColor(0x6F4E37)
        .setTitle(`📋 Monthly Partnership Review — ${month}`)
        .setDescription(
          `## ${partner.name}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `> This is your monthly activity check-in for the partnership with **${partner.name}**.\n\n` +
          `**Representative:** <@${partner.representativeId}>\n` +
          `**Roblox Group:** [Click here](${partner.robloxLink})\n` +
          `**Discord:** [Join](${partner.discordInvite})\n\n` +
          `*Please confirm your partnership activity by clicking the button below.*`
        )
        .setTimestamp()
        .setFooter({ text: 'Roastin Coffee PR System' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`review_confirm:${partner._id}`)
          .setLabel('✅ Confirm Activity')
          .setStyle(ButtonStyle.Success)
      );

      await channel.send({ content: `<@${partner.representativeId}>`, embeds: [embed], components: [row] });
    }
  }
}

async function handleReviewConfirm(interaction) {
  const partnerId = interaction.customId.split(':')[1];
  const partner = await Partner.findById(partnerId).catch(() => null);

  const embed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('✅ Activity Confirmed')
    .setDescription(
      `**${partner?.name ?? 'Partner'}** activity has been confirmed by <@${interaction.user.id}>.\n\n` +
      `> *Confirmed on ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}*`
    )
    .setTimestamp();

  await interaction.update({ embeds: [embed], components: [] });
}

module.exports.sendMonthlyReviews = sendMonthlyReviews;
module.exports.handleReviewConfirm = handleReviewConfirm;
