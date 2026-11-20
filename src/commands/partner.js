const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Partner = require('../models/Partner');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner')
    .setDescription('Manage Roastin Coffee partners.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Add a new partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner group name').setRequired(true))
      .addStringOption(o => o.setName('roblox').setDescription('Roblox group link').setRequired(true))
      .addStringOption(o => o.setName('discord').setDescription('Discord invite link').setRequired(true))
      .addUserOption(o => o.setName('representative').setDescription('Partner representative').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove a partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner group name').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('Edit a partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner group name').setRequired(true))
      .addStringOption(o => o.setName('roblox').setDescription('New Roblox group link'))
      .addStringOption(o => o.setName('discord').setDescription('New Discord invite link'))
      .addUserOption(o => o.setName('representative').setDescription('New representative')))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all current partners.')),

  async execute(interaction) {
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const name = interaction.options.getString('name');
      const existing = await Partner.findOne({ guildId, name });
      if (existing) return interaction.reply({ content: `❌ A partner named **${name}** already exists.`, ephemeral: true });

      await Partner.create({
        guildId,
        name,
        robloxLink: interaction.options.getString('roblox'),
        discordInvite: interaction.options.getString('discord'),
        representativeId: interaction.options.getUser('representative').id,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🤝 New Partner Added')
        .setDescription(`## ${name}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        .addFields(
          { name: '🔗 Roblox Group', value: interaction.options.getString('roblox'), inline: true },
          { name: '💬 Discord', value: interaction.options.getString('discord'), inline: true },
          { name: '👤 Representative', value: `<@${interaction.options.getUser('representative').id}>`, inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name');
      const deleted = await Partner.findOneAndDelete({ guildId, name });
      if (!deleted) return interaction.reply({ content: `❌ No partner named **${name}** found.`, ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🗑️ Partner Removed')
        .setDescription(`**${name}** has been removed from the partner list.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'edit') {
      const name = interaction.options.getString('name');
      const partner = await Partner.findOne({ guildId, name });
      if (!partner) return interaction.reply({ content: `❌ No partner named **${name}** found.`, ephemeral: true });

      if (interaction.options.getString('roblox')) partner.robloxLink = interaction.options.getString('roblox');
      if (interaction.options.getString('discord')) partner.discordInvite = interaction.options.getString('discord');
      if (interaction.options.getUser('representative')) partner.representativeId = interaction.options.getUser('representative').id;
      await partner.save();

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('✏️ Partner Updated')
        .setDescription(`**${name}** has been updated.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'list') {
      const partners = await Partner.find({ guildId });
      if (!partners.length) return interaction.reply({ content: '📋 No partners found.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(0x6F4E37)
        .setTitle('☕ Roastin Coffee — Partner List')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .setTimestamp()
        .setFooter({ text: `${partners.length} active partner(s)` });

      for (const p of partners) {
        embed.addFields({
          name: `🤝 ${p.name}`,
          value: `> 🔗 [Roblox Group](${p.robloxLink})\n> 💬 [Discord](${p.discordInvite})\n> 👤 <@${p.representativeId}>`,
          inline: false,
        });
      }

      return interaction.reply({ embeds: [embed] });
    }
  },
};
