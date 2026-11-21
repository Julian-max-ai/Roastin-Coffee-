'use strict';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { SETUP_STEPS, checkStatus } = require('./steps');
const GuildConfig = require('../models/GuildConfig');
const { card, infoCard, successCard, errorCard } = require('../ui');
const { EMOJI, COLORS } = require('../theme');

function findNextStep(cfg, guild) {
  for (let i = 0; i < SETUP_STEPS.length; i++) {
    if (SETUP_STEPS[i].required && !checkStatus(SETUP_STEPS[i].id, cfg, guild)) return i;
  }
  return SETUP_STEPS.length - 1;
}

function buildNavRow(stepIdx) {
  const step = SETUP_STEPS[stepIdx];
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`setup:${step.id}:back`).setLabel('◀ Back').setStyle(ButtonStyle.Secondary).setDisabled(stepIdx === 0),
    new ButtonBuilder().setCustomId(`setup:${step.id}:next`).setLabel('Next ▶').setStyle(ButtonStyle.Primary).setDisabled(stepIdx === SETUP_STEPS.length - 1),
    new ButtonBuilder().setCustomId(`setup:${step.id}:skip`).setLabel('Skip').setStyle(ButtonStyle.Secondary),
  );
}

async function renderStep(interaction, stepId, isUpdate = false) {
  const { guildId, guild } = interaction;
  const cfg = await GuildConfig.findOne({ guildId });
  const stepIdx = SETUP_STEPS.findIndex(s => s.id === stepId);
  if (stepIdx === -1) return interaction.reply({ content: 'Unknown step.', ephemeral: true });

  const step = SETUP_STEPS[stepIdx];
  const done = checkStatus(step.id, cfg, guild);
  const statusIcon = done ? '✅' : (step.required ? '⚠️' : '➖');

  let desc = `**Step ${stepIdx + 1}/${SETUP_STEPS.length}: ${step.title}** ${statusIcon}\n\n`;
  desc += `**What is this for?**\n${step.why}\n\n`;
  desc += `**What you need to do:**\n${step.how.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n`;

  // Step-specific controls
  const controls = [];
  if (step.id === 'roles') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:roles:createAdmin').setLabel('Create Admin Role').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('setup:roles:createStaff').setLabel('Create Staff Role').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('setup:roles:createRep').setLabel('Create Rep Role').setStyle(ButtonStyle.Secondary),
    );
    controls.push(row);
    if (cfg?.adminRoles?.length) desc += `\n**Admin Roles:** ${cfg.adminRoles.map(r => `<@&${r}>`).join(', ')}`;
    if (cfg?.prStaffRoles?.length) desc += `\n**Staff Roles:** ${cfg.prStaffRoles.map(r => `<@&${r}>`).join(', ')}`;
    if (cfg?.partnerRepRoles?.length) desc += `\n**Rep Roles:** ${cfg.partnerRepRoles.map(r => `<@&${r}>`).join(', ')}`;
  }

  if (step.id === 'channels') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:channels:createAll').setLabel('Create All for Me').setStyle(ButtonStyle.Primary),
    );
    controls.push(row);
    if (cfg?.logChannel) desc += `\n**Log:** <#${cfg.logChannel}>`;
    if (cfg?.transcriptChannel) desc += `\n**Transcript:** <#${cfg.transcriptChannel}>`;
    if (cfg?.reviewChannel) desc += `\n**Review:** <#${cfg.reviewChannel}>`;
    if (cfg?.announcementChannel) desc += `\n**Announcement:** <#${cfg.announcementChannel}>`;
    if (cfg?.partnerListChannel) desc += `\n**Partner List:** <#${cfg.partnerListChannel}>`;
  }

  if (step.id === 'tickets') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:tickets:createCat').setLabel('Create Ticket Category').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('setup:tickets:initTypes').setLabel('Initialize Ticket Types').setStyle(ButtonStyle.Secondary),
    );
    controls.push(row);
    if (cfg?.ticketCategory) desc += `\n**Ticket Category:** <#${cfg.ticketCategory}>`;
  }

  if (step.id === 'dweeb') {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:dweeb:testTicket').setLabel('Open Test Ticket').setStyle(ButtonStyle.Secondary),
    );
    controls.push(row);
  }

  if (step.id === 'welcome') {
    const me = guild?.members?.me;
    const checks = [];
    const perms = ['ManageChannels', 'ManageRoles', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ManageMessages'];
    for (const p of perms) {
      const has = me?.permissions?.has(PermissionFlagsBits[p]) ?? false;
      checks.push(`${has ? '✅' : '❌'} ${p}`);
    }
    desc += `\n\n**Bot Permissions:**\n${checks.join('\n')}`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('setup:welcome:recheck').setLabel('Re-check').setStyle(ButtonStyle.Secondary),
    );
    controls.push(row);
  }

  const navRow = buildNavRow(stepIdx);
  controls.push(navRow);

  const payload = card({
    title: `Setup Wizard — Step ${stepIdx + 1}/${SETUP_STEPS.length}`,
    description: desc,
    color: COLORS.primary,
    buttons: [],
    ephemeral: true,
  });
  // Add controls to the card's components by rebuilding
  // Since card() doesn't accept component rows directly in buttons param easily,
  // we'll use the payload and append rows
  const allComponents = [payload];
  // Actually, let's just send the card with the rows as buttons
  // The card function accepts buttons array
  const allButtons = [];
  for (const row of controls) {
    // row is already an ActionRowBuilder
  }

  // Build a proper card with all rows
  const parts = [];
  const { TextDisplayBuilder, SeparatorBuilder } = require('discord.js');
  parts.push(new TextDisplayBuilder().setContent(`## Setup Wizard — Step ${stepIdx + 1}/${SETUP_STEPS.length}`));
  parts.push(new SeparatorBuilder().setDivider(true).setSpacing(1));
  parts.push(new TextDisplayBuilder().setContent(desc));
  for (const row of controls) {
    parts.push(new SeparatorBuilder().setDivider(false).setSpacing(1));
    parts.push(row);
  }
  parts.push(new SeparatorBuilder().setDivider(true).setSpacing(1));
  parts.push(require('../ui').footer());

  const { buildContainer } = require('../ui');
  const container = buildContainer(parts, COLORS.primary, true);

  if (isUpdate) {
    await interaction.update(container).catch(() => interaction.editReply(container));
  } else {
    await interaction.editReply(container);
  }
}

async function handleSetupAction(interaction, stepId, action) {
  const { guildId, guild } = interaction;
  const cfg = await GuildConfig.findOne({ guildId });

  if (action === 'back') {
    const idx = SETUP_STEPS.findIndex(s => s.id === stepId);
    if (idx > 0) await renderStep(interaction, SETUP_STEPS[idx - 1].id, true);
    return;
  }
  if (action === 'next' || action === 'skip') {
    const idx = SETUP_STEPS.findIndex(s => s.id === stepId);
    if (idx < SETUP_STEPS.length - 1) await renderStep(interaction, SETUP_STEPS[idx + 1].id, true);
    return;
  }

  // Step-specific actions
  if (stepId === 'roles') {
    if (action === 'createAdmin') {
      const role = await guild.roles.create({ name: 'PR Admin', color: 0x5865F2 }).catch(() => null);
      if (role) {
        await GuildConfig.findOneAndUpdate({ guildId }, { $addToSet: { adminRoles: role.id } }, { upsert: true });
        await interaction.followUp({ content: `Created role: ${role.name}`, ephemeral: true }).catch(() => {});
      }
      await renderStep(interaction, stepId, true);
    } else if (action === 'createStaff') {
      const role = await guild.roles.create({ name: 'PR Staff', color: 0x57F287 }).catch(() => null);
      if (role) {
        await GuildConfig.findOneAndUpdate({ guildId }, { $addToSet: { prStaffRoles: role.id } }, { upsert: true });
        await interaction.followUp({ content: `Created role: ${role.name}`, ephemeral: true }).catch(() => {});
      }
      await renderStep(interaction, stepId, true);
    } else if (action === 'createRep') {
      const role = await guild.roles.create({ name: 'Partner Rep', color: 0xFEE75C }).catch(() => null);
      if (role) {
        await GuildConfig.findOneAndUpdate({ guildId }, { $addToSet: { partnerRepRoles: role.id } }, { upsert: true });
        await interaction.followUp({ content: `Created role: ${role.name}`, ephemeral: true }).catch(() => {});
      }
      await renderStep(interaction, stepId, true);
    }
  }

  if (stepId === 'channels') {
    if (action === 'createAll') {
      const category = await guild.channels.create({ name: "Roastin' PR", type: ChannelType.GuildCategory }).catch(() => null);
      if (!category) {
        await interaction.followUp({ content: 'Failed to create category. Check bot permissions.', ephemeral: true }).catch(() => {});
        return;
      }
      const created = [];
      const staffRoles = [...(cfg?.prStaffRoles || []), ...(cfg?.adminRoles || [])];
      // pr-log and ticket-transcripts: staff only
      const ch1 = await guild.channels.create({ name: 'pr-log', type: ChannelType.GuildText, parent: category.id, permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...staffRoles.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] },
      ] }).catch(() => null);
      if (ch1) { created.push(ch1.name); await GuildConfig.findOneAndUpdate({ guildId }, { logChannel: ch1.id }, { upsert: true }); }
      const ch2 = await guild.channels.create({ name: 'ticket-transcripts', type: ChannelType.GuildText, parent: category.id, permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        ...staffRoles.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] },
      ] }).catch(() => null);
      if (ch2) { created.push(ch2.name); await GuildConfig.findOneAndUpdate({ guildId }, { transcriptChannel: ch2.id }, { upsert: true }); }
      // announcements and partner-list: everyone can read, only bot/staff can send
      const ch4 = await guild.channels.create({ name: 'announcements', type: ChannelType.GuildText, parent: category.id, permissionOverwrites: [
        { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
        ...staffRoles.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] },
      ] }).catch(() => null);
      if (ch4) { created.push(ch4.name); await GuildConfig.findOneAndUpdate({ guildId }, { announcementChannel: ch4.id }, { upsert: true }); }
      const ch5 = await guild.channels.create({ name: 'partner-list', type: ChannelType.GuildText, parent: category.id, permissionOverwrites: [
        { id: guild.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
        ...staffRoles.map(r => ({ id: r, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.EmbedLinks] },
      ] }).catch(() => null);
      if (ch5) { created.push(ch5.name); await GuildConfig.findOneAndUpdate({ guildId }, { partnerListChannel: ch5.id }, { upsert: true }); }
      await interaction.followUp({ content: `Created: ${created.join(', ')}`, ephemeral: true }).catch(() => {});
      await renderStep(interaction, stepId, true);
    }
  }

  if (stepId === 'tickets') {
    if (action === 'createCat') {
      const cat = await guild.channels.create({ name: 'Tickets', type: ChannelType.GuildCategory }).catch(() => null);
      if (cat) {
        await GuildConfig.findOneAndUpdate({ guildId }, { ticketCategory: cat.id }, { upsert: true });
        await interaction.followUp({ content: `Created category: ${cat.name}`, ephemeral: true }).catch(() => {});
      }
      await renderStep(interaction, stepId, true);
    } else if (action === 'initTypes') {
      // Delegate to ticket setup
      await interaction.followUp({ content: 'Run /ticket setup to initialize ticket types.', ephemeral: true }).catch(() => {});
    }
  }

  if (stepId === 'welcome') {
    if (action === 'recheck') {
      await renderStep(interaction, stepId, true);
      return;
    }
  }

  if (stepId === 'dweeb') {
    if (action === 'testTicket') {
      await interaction.followUp({ content: 'Use /ticket open to create a test ticket.', ephemeral: true }).catch(() => {});
    }
  }
}

module.exports = { renderStep, handleSetupAction, findNextStep };
