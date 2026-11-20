const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const Partner = require('../models/Partner');
const Infraction = require('../models/Infraction');

const TYPE_EMOJI = { warning: '⚠️', strike: '🔴', termination: '🚫' };

module.exports = {
  data: new SlashCommandBuilder()
    .setName('infraction')
    .setDescription('Manage partner infractions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Issue a warning, strike, or termination.')
      .addStringOption(o => o.setName('partner').setDescription('Partner name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('type').setDescription('Infraction type').setRequired(true)
        .addChoices(
          { name: '⚠️ Warning', value: 'warning' },
          { name: '🔴 Strike', value: 'strike' },
          { name: '🚫 Termination', value: 'termination' },
        ))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('View all active infractions for a partner.')
      .addStringOption(o => o.setName('partner').setDescription('Partner name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Remove an infraction by ID.')
      .addStringOption(o => o.setName('id').setDescription('Infraction ID').setRequired(true))),

  async autocomplete(interaction) {
    const partners = await Partner.find({ guildId: interaction.guildId });
    const focused = interaction.options.getFocused().toLowerCase();
    await interaction.respond(
      partners.filter(p => p.name.toLowerCase().includes(focused)).slice(0, 25).map(p => ({ name: p.name, value: p.name }))
    );
  },

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
        guildId, partnerId: partner._id.toString(), type, reason, issuedBy: interaction.user.id,
      });

      const activeStrikes = await Infraction.countDocuments({ guildId, partnerId: partner._id.toString(), type: 'strike', removed: false });

      const msg =
        `## ${TYPE_EMOJI[type]} ${type.charAt(0).toUpperCase() + type.slice(1)} Issued\n` +
        `-# Roastin Coffee Infraction System\n\n` +
        `**Partner:** ${partner.name}\n` +
        `**Reason:** ${reason}\n` +
        `**Issued by:** <@${interaction.user.id}>\n` +
        `**Date:** ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}\n` +
        `**ID:** \`${infraction._id}\`\n` +
        (type === 'strike' ? `\n> ⚡ **Active Strikes:** ${activeStrikes}` : '');

      await interaction.reply({ content: msg });

      if (cfg?.logChannel) {
        const logCh = await interaction.client.channels.fetch(cfg.logChannel).catch(() => null);
        if (logCh) await logCh.send(msg);
      }

      try {
        const rep = await interaction.client.users.fetch(partner.representativeId);
        await rep.send(
          `## ${TYPE_EMOJI[type]} Partnership ${type.charAt(0).toUpperCase() + type.slice(1)}\n` +
          `-# Roastin Coffee PR System\n\n` +
          `You have received a **${type}** for the partnership **${partner.name}**.\n\n` +
          `**Reason:** ${reason}\n` +
          `**Date:** ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}\n\n` +
          `> *If you have questions, please contact Roastin Coffee PR Staff.*`
        );
      } catch { /* DMs closed */ }
    }

    if (sub === 'list') {
      const partnerName = interaction.options.getString('partner');
      const partner = await Partner.findOne({ guildId, name: partnerName });
      if (!partner) return interaction.reply({ content: `❌ No partner named **${partnerName}** found.`, ephemeral: true });

      const infractions = await Infraction.find({ guildId, partnerId: partner._id.toString(), removed: false });

      let msg = `## 📋 Infractions — ${partner.name}\n-# ${infractions.length} active infraction(s)\n\n`;
      if (!infractions.length) {
        msg += `✅ No active infractions.`;
      } else {
        for (const inf of infractions) {
          msg += `${TYPE_EMOJI[inf.type]} **${inf.type.charAt(0).toUpperCase() + inf.type.slice(1)}** — ${new Date(inf.issuedAt).toLocaleDateString('en-US')}\n`;
          msg += `> **Reason:** ${inf.reason} • **By:** <@${inf.issuedBy}> • **ID:** \`${inf._id}\`\n\n`;
        }
      }

      return interaction.reply({ content: msg, ephemeral: true });
    }

    if (sub === 'remove') {
      const id = interaction.options.getString('id');
      const infraction = await Infraction.findOneAndUpdate({ _id: id, guildId }, { removed: true }).catch(() => null);
      if (!infraction) return interaction.reply({ content: '❌ Infraction not found.', ephemeral: true });

      return interaction.reply({ content: `## ✅ Infraction Removed\n\nInfraction \`${id}\` has been removed.` });
    }
  },
};
