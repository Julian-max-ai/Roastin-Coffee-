'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const mongoose = require('mongoose');
const GuildConfig = require('../models/GuildConfig');
const { doctorCard, errorCard } = require('../ui');
const { getLastRun } = require('../scheduler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('doctor')
    .setDescription('Bot health check and diagnostics.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guildId, client } = interaction;
    const checks = [];

    // MongoDB ping
    const dbStart = Date.now();
    try {
      await mongoose.connection.db.admin().ping();
      checks.push({ name: 'MongoDB', ok: true, detail: `Ping ${Date.now() - dbStart}ms` });
    } catch { checks.push({ name: 'MongoDB', ok: false, detail: 'Connection failed' }); }

    // Config completeness
    const cfg = await GuildConfig.findOne({ guildId });
    const missing = [];
    if (!cfg?.announcementChannel) missing.push('Announcement Channel');
    if (!cfg?.reviewChannel) missing.push('Review Channel');
    if (!cfg?.logChannel) missing.push('Log Channel');
    if (!cfg?.ticketCategory) missing.push('Ticket Category');
    if (!cfg?.prStaffRoles?.length) missing.push('PR Staff Roles');
    if (!cfg?.transcriptChannel) missing.push('Transcript Channel');
    checks.push({ name: 'Config', ok: missing.length === 0, detail: missing.length ? `Missing: ${missing.join(', ')}` : 'All set' });

    // Bot permissions in configured channels
    const channelsToCheck = [cfg?.announcementChannel, cfg?.reviewChannel, cfg?.logChannel, cfg?.partnerListChannel, cfg?.transcriptChannel].filter(Boolean);
    let permIssues = [];
    for (const chId of channelsToCheck) {
      try {
        const ch = await client.channels.fetch(chId);
        const me = ch.guild.members.cache.get(client.user.id) || await ch.guild.members.fetch(client.user.id).catch(() => null);
        const perms = ch.permissionsFor(me);
        if (!perms || !perms.has('ViewChannel') || !perms.has('SendMessages')) permIssues.push(ch.name || chId);
      } catch { permIssues.push(`<#${chId}>`); }
    }
    checks.push({ name: 'Channel Permissions', ok: permIssues.length === 0, detail: permIssues.length ? `No access: ${permIssues.join(', ')}` : 'OK' });

    // Cron last run
    const jobs = ['ticketInactivity', 'ticketCloseRequest', 'closedTicketCleanup', 'infractionExpiry', 'reviewReminders', 'eventReminders', 'anniversaries'];
    for (const job of jobs) {
      const last = getLastRun(job, guildId);
      checks.push({ name: `Job: ${job}`, ok: last ? true : 'warn', detail: last ? `Last run: ${last.toISOString()}` : 'Never run' });
    }

    // Partner channel missing
    const Partner = require('../models/Partner');
    const missingChannels = await Partner.countDocuments({ guildId, channelMissing: true }).catch(() => 0);
    checks.push({ name: 'Partner Channels', ok: missingChannels === 0, detail: missingChannels ? `${missingChannels} partner(s) with missing channel` : 'OK' });

    checks.push({ name: 'Bot Online', ok: true, detail: `Uptime ${Math.floor(process.uptime() / 60)} min` });

    const allOk = checks.every(c => c.ok === true);
    await interaction.editReply(doctorCard(checks));
  },
};
