'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Partner = require('../models/Partner');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isRobloxLink, isDiscordInvite } = require('../utils/format');
const { isStaff } = require('../utils/permissions');
const { createPartnerChannel } = require('../utils/partnerChannelCreate');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('partner-add')
    .setDescription('Add partner.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(o => o.setName('name').setDescription('Name').setRequired(true))
    .addStringOption(o => o.setName('roblox').setDescription('Roblox-Link').setRequired(true))
    .addStringOption(o => o.setName('discord').setDescription('Discord-Invite').setRequired(true))
    .addUserOption(o => o.setName('representative').setDescription('Representative').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Partner-Channel (optional)'))
    .addBooleanOption(o => o.setName('create-channel').setDescription('Channel erstellen')),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId, guild } = interaction;
    const cfg = await GuildConfig.findOne({ guildId });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const name = interaction.options.getString('name');
    const roblox = interaction.options.getString('roblox');
    const disc = interaction.options.getString('discord');
    const rep = interaction.options.getUser('representative');

    if (!isRobloxLink(roblox)) return interaction.editReply(errorCard('Invalid Roblox link.'));
    if (!isDiscordInvite(disc)) return interaction.editReply(errorCard('Invalid Discord invite.'));
    if (await Partner.findOne({ guildId, name })) return interaction.editReply(errorCard(`Partner **${name}** already exists.`));

    const partner = await Partner.create({
      guildId, name, robloxLink: roblox, discordInvite: disc,
      representativeId: rep.id, representativeIds: [rep.id],
    });

    let channel = interaction.options.getChannel('channel');
    if (!channel && interaction.options.getBoolean('create-channel')) {
      channel = await createPartnerChannel(guild, partner, cfg);
    }
    if (channel) {
      partner.channelId = channel.id;
      await partner.save();
    }

    // Auto-assign rep role
    let roleAssigned = false;
    if (cfg?.automation?.autoAssignRepRoles && cfg?.partnerRepRoles?.length) {
      try {
        const member = await guild.members.fetch(rep.id);
        await member.roles.add(cfg.partnerRepRoles);
        roleAssigned = true;
      } catch {}
    }

    await require('../utils/audit').audit(guildId, interaction.user.id, 'partner_add', 'partner', partner._id.toString(), { name, channel: channel?.id });

    let desc = `**${name}** added.\n`;
    desc += `Channel: ${channel ? `<#${channel.id}>` : 'No channel'}\n`;
    desc += `Rep-Rolle: ${roleAssigned ? '✅' : '❌'}`;
    await interaction.editReply(successCard(desc));
  },
};
