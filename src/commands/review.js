const {
  SlashCommandBuilder, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const Partner = require('../models/Partner');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('review')
    .setDescription('Monthly partnership review system.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub.setName('send').setDescription('Manually send the monthly partnership review.')),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    await sendMonthlyReviews(interaction.client, interaction.guildId);
    await interaction.editReply({ content: '✅ Monthly review sent.' });
  },
};

async function sendMonthlyReviews(client, targetGuildId = null) {
  const configs = targetGuildId
    ? await GuildConfig.find({ guildId: targetGuildId })
    : await GuildConfig.find({ reviewChannel: { $ne: null } });

  for (const cfg of configs) {
    if (!cfg.reviewChannel) continue;
    const partners = await Partner.find({ guildId: cfg.guildId });
    if (!partners.length) continue;

    const channel = await client.channels.fetch(cfg.reviewChannel).catch(() => null);
    if (!channel) continue;

    const month = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

    for (const partner of partners) {
      const text =
        `## 📋 Monthly Partnership Review — ${month}\n` +
        `-# Roastin Coffee PR System\n\n` +
        (cfg.reviewText || 'Please complete your monthly review.') + '\n\n' +
        `**Partner:** ${partner.name}\n` +
        `**Representative:** <@${partner.representativeId}>\n\n` +
        `> 🔗 [Roblox Group](${partner.robloxLink}) • 💬 [Discord](${partner.discordInvite})`;

      const components = [];

      if (cfg.reviewMode === 'link' && cfg.reviewLink) {
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('📝 Complete Review')
            .setURL(cfg.reviewLink)
            .setStyle(ButtonStyle.Link)
        ));
      } else {
        components.push(new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`review_start:${partner._id}`)
            .setLabel('📝 Start Review')
            .setStyle(ButtonStyle.Primary)
        ));
      }

      await channel.send({ content: `<@${partner.representativeId}>`, components });
      await channel.send({ content: text, components: [] });
    }
  }
}

async function handleReviewStart(interaction) {
  const partnerId = interaction.customId.split(':')[1];
  const partner = await Partner.findById(partnerId).catch(() => null);
  const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });

  if (!partner || !cfg) return interaction.reply({ content: '❌ Error finding partner data.', ephemeral: true });

  const questions = cfg.reviewQuestions?.length ? cfg.reviewQuestions : ['How active was your group this month?', 'Any events hosted?', 'Any issues to report?'];

  await interaction.reply({
    content:
      `## 📋 Review Started — ${partner.name}\n\n` +
      `I will send you the review questions via DM.\n` +
      `-# Check your DMs!`,
    ephemeral: true,
  });

  try {
    const user = await interaction.client.users.fetch(partner.representativeId);
    let dmText = `## 📋 Monthly Review — ${partner.name}\n-# Roastin Coffee PR System\n\nPlease answer the following questions:\n\n`;
    questions.forEach((q, i) => { dmText += `**${i + 1}.** ${q}\n`; });
    dmText += `\n> *Reply to this message with your answers.*`;
    await user.send(dmText);
  } catch {
    await interaction.followUp({ content: '❌ Could not send DM. Please check your DM settings.', ephemeral: true });
  }
}

module.exports.sendMonthlyReviews = sendMonthlyReviews;
module.exports.handleReviewStart = handleReviewStart;
