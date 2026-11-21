'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const Partner = require('../models/Partner');
const Ad = require('../models/Ad');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ad')
    .setDescription('Manage partner advertisements.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('post').setDescription('Post an ad for a partner.')
      .addStringOption(o => o.setName('partner').setDescription('Partner name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('title').setDescription('Ad title').setRequired(true))
      .addStringOption(o => o.setName('link').setDescription('Ad link').setRequired(true))
      .addStringOption(o => o.setName('image').setDescription('Image URL (optional)')))
    .addSubcommand(s => s.setName('list').setDescription('List ads for a partner.')
      .addStringOption(o => o.setName('partner').setDescription('Partner name').setRequired(true).setAutocomplete(true))),
  async autocomplete(interaction) {
    const cfg = await GuildConfig.findOne({ guildId: interaction.guildId });
    const Partner = require('../models/Partner');
    const partners = await Partner.find({ guildId: interaction.guildId }).select('name').catch(() => []);
    const focused = interaction.options.getFocused().toLowerCase();
    await interaction.respond(partners.filter(p => p.name.toLowerCase().includes(focused)).slice(0, 25).map(p => ({ name: p.name, value: p.name })));
  },
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId, guild, client } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));
    const sub = interaction.options.getSubcommand();

    if (sub === 'post') {
      const partnerName = interaction.options.getString('partner');
      const partner = await Partner.findOne({ guildId, name: partnerName });
      if (!partner) return interaction.editReply(errorCard('Partner not found.'));
      const title = interaction.options.getString('title');
      const link = interaction.options.getString('link');
      const image = interaction.options.getString('image');

      const ad = await Ad.create({ guildId, partnerId: partner._id, title, link, image });

      const channel = cfg?.announcementChannel ? await client.channels.fetch(cfg.announcementChannel).catch(() => null) : null;
      if (channel) {
        const { card } = require('../ui');
        const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const embed = new EmbedBuilder().setTitle(title).setURL(link).setDescription(`Partner: **${partner.name}**`).setColor(0x5865F2);
        if (image) embed.setImage(image);
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View').setStyle(ButtonStyle.Link).setURL(link));
        const msg = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
        if (msg) { ad.messageId = msg.id; ad.channelId = channel.id; await ad.save(); }
      }
      return interaction.editReply(successCard(`Ad **${title}** posted for **${partner.name}**.`));
    }

    if (sub === 'list') {
      const partnerName = interaction.options.getString('partner');
      const partner = await Partner.findOne({ guildId, name: partnerName });
      if (!partner) return interaction.editReply(errorCard('Partner not found.'));
      const ads = await Ad.find({ guildId, partnerId: partner._id }).sort({ postedAt: -1 }).limit(10);
      if (!ads.length) return interaction.editReply(errorCard('No ads found.'));
      const desc = ads.map(a => `**${a.title}** — ${a.link} (${a.clicks} clicks)`).join('\n');
      return interaction.editReply(successCard(desc));
    }
  },
};
