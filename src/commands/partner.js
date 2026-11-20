const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');

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
      .addStringOption(o => o.setName('name').setDescription('Partner name').setRequired(true).setAutocomplete(true)))
    .addSubcommand(sub => sub
      .setName('edit')
      .setDescription('Edit a partner.')
      .addStringOption(o => o.setName('name').setDescription('Partner name').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('roblox').setDescription('New Roblox group link'))
      .addStringOption(o => o.setName('discord').setDescription('New Discord invite link'))
      .addUserOption(o => o.setName('representative').setDescription('New representative')))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('List all current partners.')),

  async autocomplete(interaction) {
    const partners = await Partner.find({ guildId: interaction.guildId });
    const focused = interaction.options.getFocused().toLowerCase();
    const choices = partners
      .filter(p => p.name.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(p => ({ name: p.name, value: p.name }));
    await interaction.respond(choices);
  },

  async execute(interaction) {
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const name = interaction.options.getString('name');
      const existing = await Partner.findOne({ guildId, name });
      if (existing) return interaction.reply({ content: `❌ A partner named **${name}** already exists.`, ephemeral: true });

      const partner = await Partner.create({
        guildId,
        name,
        robloxLink: interaction.options.getString('roblox'),
        discordInvite: interaction.options.getString('discord'),
        representativeId: interaction.options.getUser('representative').id,
      });

      await interaction.reply({
        content:
          `## 🤝 New Partner Added\n` +
          `-# Roastin Coffee Partnership System\n\n` +
          `**${name}** has been added as a partner.\n\n` +
          `> 👤 **Representative:** <@${partner.representativeId}>\n` +
          `> 🔗 **Roblox:** [Group Link](${partner.robloxLink})\n` +
          `> 💬 **Discord:** [Join Server](${partner.discordInvite})\n` +
          `> 📅 **Since:** ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`,
      });

      await updatePartnerList(interaction.client, guildId);
    }

    if (sub === 'remove') {
      const name = interaction.options.getString('name');
      const deleted = await Partner.findOneAndDelete({ guildId, name });
      if (!deleted) return interaction.reply({ content: `❌ No partner named **${name}** found.`, ephemeral: true });

      await interaction.reply({
        content:
          `## 🗑️ Partner Removed\n\n` +
          `**${name}** has been removed from the partner list.`,
      });

      await updatePartnerList(interaction.client, guildId);
    }

    if (sub === 'edit') {
      const name = interaction.options.getString('name');
      const partner = await Partner.findOne({ guildId, name });
      if (!partner) return interaction.reply({ content: `❌ No partner named **${name}** found.`, ephemeral: true });

      if (interaction.options.getString('roblox')) partner.robloxLink = interaction.options.getString('roblox');
      if (interaction.options.getString('discord')) partner.discordInvite = interaction.options.getString('discord');
      if (interaction.options.getUser('representative')) partner.representativeId = interaction.options.getUser('representative').id;
      await partner.save();

      await interaction.reply({
        content:
          `## ✏️ Partner Updated\n\n` +
          `**${name}** has been updated.\n\n` +
          `> 👤 **Representative:** <@${partner.representativeId}>\n` +
          `> 🔗 **Roblox:** [Group Link](${partner.robloxLink})\n` +
          `> 💬 **Discord:** [Join Server](${partner.discordInvite})`,
      });

      await updatePartnerList(interaction.client, guildId);
    }

    if (sub === 'list') {
      const partners = await Partner.find({ guildId });
      if (!partners.length) return interaction.reply({ content: '📋 No partners found.', ephemeral: true });

      let list = `## 🤝 Partner List\n-# ${partners.length} active partner(s)\n\n`;
      for (const p of partners) {
        list += `**${p.name}**\n> 👤 <@${p.representativeId}> • 🔗 [Roblox](${p.robloxLink}) • 💬 [Discord](${p.discordInvite})\n\n`;
      }

      return interaction.reply({ content: list, ephemeral: true });
    }
  },
};

async function updatePartnerList(client, guildId) {
  const cfg = await GuildConfig.findOne({ guildId });
  if (!cfg?.partnerListChannel) return;

  const channel = await client.channels.fetch(cfg.partnerListChannel).catch(() => null);
  if (!channel) return;

  const partners = await Partner.find({ guildId });

  let partnerBlock = '';
  for (const p of partners) {
    partnerBlock += `**[${p.name}](${p.discordInvite})**\n> 👤 <@${p.representativeId}> • 🔗 [Roblox Group](${p.robloxLink})\n\n`;
  }
  if (!partnerBlock) partnerBlock = '*No active partners yet.*';

  const text = (cfg.partnerListText || '## 🤝 Our Partners\n\n{partners}').replace('{partners}', partnerBlock);

  if (cfg.partnerListMessageId) {
    const msg = await channel.messages.fetch(cfg.partnerListMessageId).catch(() => null);
    if (msg) return msg.edit(text);
  }

  const sent = await channel.send(text);
  await GuildConfig.findOneAndUpdate({ guildId }, { partnerListMessageId: sent.id });
}

module.exports.updatePartnerList = updatePartnerList;
