const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const Partner = require('../models/Partner');
const Infraction = require('../models/Infraction');

const TYPE_COLORS = { warning: 0xFEE75C, strike: 0xFF8C00, termination: 0xED4245 };
const TYPE_EMOJI  = { warning: '⚠️', strike: '🔴', termination: '🚫' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction')
    .setDescription('Manage partner infractions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Issue a warning, strike, or termination.')
      .addStringOption(o => o.setName('partner').setDescription('Partner name').setRequired(true))
      .addStringOption(o => o.setName('type').setDescription('Infraction type').setRequired(true)
        .addChoices(
          { name: 'Warning', value: 'warning' },
          { name: 'Strike', value: 'strike' },
          { name: 'Termination', value: 'termination' },
        ))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('View all active infractions for a partner.')
      .addStringOption(o => o.setName('partner').setDescription('Partner name').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove an infraction by its ID.')
      .addStringOption(o => o.setName('id').setDescription('Infraction ID').setRequired(true))),

  async execute(interaction) {
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();
    const cfg = await GuildConfig.findOne({ guildId });

    if (sub === 'add') {
      const partnerName = interaction.options.getString('partner');
      const type = interaction.options.getString('type');
      const reason = interaction.options.getString('reason');

      const partner = await Partner.findOne({ guildId, name: partnerName });
      if (!partner) return interaction.reply({ content: `❌ No partner named **${partnerName}** found.`, ephemeral: true });

      const infraction = await Infraction.create({
        guildId,
        partnerId: partner._id.toString(),
        type,
        reason,
        issuedBy: interaction.user.id,
      });

      const activeStrikes = await Infraction.countDocuments({ guildId, partnerId: partner._id.toString(), type: 'strike', removed: false });

      const embed = new EmbedBuilder()
        .setColor(TYPE_COLORS[type])
        .setTitle(`${TYPE_EMOJI[type]} ${type.charAt(0).toUpperCase() + type.slice(1)} Issued`)
        .setDescription(
          `## ${partner.name}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `**Type:** ${TYPE_EMOJI[type]} ${type.charAt(0).toUpperCase() + type.slice(1)}\n` +
          `**Reason:** ${reason}\n` +
          `**Issued by:** <@${interaction.user.id}>\n` +
          `**Date:** ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}\n` +
          `**Infraction ID:** \`${infraction._id}\`\n\n` +
          (type === 'strike' ? `> ⚡ **Active Strikes:** ${activeStrikes}` : '')
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Log channel notification
      if (cfg?.logChannel) {
        const logCh = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
        if (logCh) await logCh.send({ embeds: [embed] });
      }

      // DM the representative
      try {
        const rep = await interaction.client.users.fetch(partner.representativeId);
        const dmEmbed = new EmbedBuilder()
          .setColor(TYPE_COLORS[type])
          .setTitle(`${TYPE_EMOJI[type]} Partnership ${type.charAt(0).toUpperCase() + type.slice(1)} — ${partner.name}`)
          .setDescription(
            `You have received a **${type}** regarding the partnership **${partner.name}**.\n\n` +
            `**Reason:** ${reason}\n` +
            `**Date:** ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}\n\n` +
            `> *If you have questions, please contact Roastin Coffee PR Staff.*`
          )
          .setTimestamp();
        await rep.send({ embeds: [dmEmbed] });
      } catch { /* DMs may be closed */ }
    }

    if (sub === 'list') {
      const partnerName = interaction.options.getString('partner');
      const partner = await Partner.findOne({ guildId, name: partnerName });
      if (!partner) return interaction.reply({ content: `❌ No partner named **${partnerName}** found.`, ephemeral: true });

      const infractions = await Infraction.find({ guildId, partnerId: partner._id.toString(), removed: false });

      const embed = new EmbedBuilder()
        .setColor(0x6F4E37)
        .setTitle(`📋 Infractions — ${partner.name}`)
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .setTimestamp()
        .setFooter({ text: `${infractions.length} active infraction(s)` });

      if (!infractions.length) {
        embed.setDescription('✅ No active infractions.');
      } else {
        for (const inf of infractions) {
          embed.addFields({
            name: `${TYPE_EMOJI[inf.type]} ${inf.type.charAt(0).toUpperCase() + inf.type.slice(1)} — ${new Date(inf.issuedAt).toLocaleDateString('en-US')}`,
            value: `> **Reason:** ${inf.reason}\n> **By:** <@${inf.issuedBy}>\n> **ID:** \`${inf._id}\``,
          });
        }
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id');
      const infraction = await Infraction.findOneAndUpdate(
        { _id: id, guildId },
        { removed: true },
        { new: true }
      ).catch(() => null);

      if (!infraction) return interaction.reply({ content: '❌ Infraction not found.', ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Infraction Removed')
        .setDescription(`Infraction \`${id}\` has been marked as removed.`)
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
  },
};
