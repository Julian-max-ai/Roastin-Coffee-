'use strict';
const { MessageFlags } = require('discord.js');
const { errorCard } = require('../ui');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      await route(interaction, client);
    } catch (err) {
      console.error('[interactionCreate]', err);
      const reply = errorCard('Something went wrong. Please try again or contact an admin.');
      try {
        interaction.replied || interaction.deferred
          ? await interaction.followUp(reply)
          : await interaction.reply(reply);
      } catch {}
    }
  },
};

async function route(interaction, client) {

  // ── Slash commands ──────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;
    await cmd.execute(interaction);
    return;
  }

  // ── Autocomplete ────────────────────────────────────────────────────────────
  if (interaction.isAutocomplete()) {
    const cmd = client.commands.get(interaction.commandName);
    if (cmd?.autocomplete) await cmd.autocomplete(interaction);
    return;
  }

  // ── Modal submits ───────────────────────────────────────────────────────────
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;
    if (id.startsWith('dweeb_send:') || id.startsWith('dweeb_edit:')) {
      return require('../commands/dweeb').handleDweebModal(interaction);
    }
    if (id.startsWith('ticket_edit:')) {
      return require('../commands/ticket-panel').handleTicketEditModal(interaction);
    }
    if (id.startsWith('review_submit:')) {
      return require('../commands/review').handleReviewSubmit(interaction);
    }
    if (id.startsWith('event_deny_reason:')) {
      return require('../commands/event-request').handleEventDenyModal(interaction);
    }
    if (id.startsWith('cfg_text_modal:') || id === 'cfg_reviewLink_modal') {
      return require('../commands/config').handleConfigInteraction(interaction);
    }
    return;
  }

  // ── Config interactions (selects + buttons) ─────────────────────────────────
  const { handleConfigInteraction } = require('../commands/config');
  const cfgIds = ['cfg_category', 'cfg_ch_pick', 'cfg_reviewMode', 'cfg_text_pick'];
  const cfgChannelIds = id => id?.startsWith('cfg_channel:') || id === 'cfg_ticketCategory';
  const cfgRoleIds    = ['cfg_prStaffRoles', 'cfg_partnerRepRoles'];
  const cfgButtonIds  = ['cfg_back', 'cfg_setReviewLink'];

  if (
    (interaction.isStringSelectMenu()  && cfgIds.includes(interaction.customId)) ||
    (interaction.isChannelSelectMenu() && cfgChannelIds(interaction.customId)) ||
    (interaction.isRoleSelectMenu()    && cfgRoleIds.includes(interaction.customId)) ||
    (interaction.isButton()            && cfgButtonIds.includes(interaction.customId))
  ) {
    return handleConfigInteraction(interaction);
  }

  // ── Buttons ─────────────────────────────────────────────────────────────────
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id.startsWith('ticket_open:'))          return require('../commands/ticket-panel').handleTicketOpen(interaction);
    if (id === 'ticket_close')                  return require('../commands/ticket-panel').handleTicketClose(interaction);
    if (id === 'ticket_claim')                  return require('../commands/ticket-panel').handleTicketClaim(interaction);
    if (id.startsWith('review_start:'))         return require('../commands/review').handleReviewStart(interaction);
    if (id.startsWith('event_approve:') || id.startsWith('event_deny:')) {
      return require('../commands/event-request').handleEventDecision(interaction);
    }
    if (id.startsWith('partner_confirm_remove:')) {
      const partnerId = id.split(':')[1];
      const Partner   = require('../models/Partner');
      const GuildConfig = require('../models/GuildConfig');
      const partner   = await Partner.findByIdAndDelete(partnerId);
      if (!partner) return interaction.update(errorCard('Partner not found.'));
      await interaction.update({ ...require('../ui').successCard(`**${partner.name}** has been removed.`), components: [] });
      await require('../commands/partner').updatePartnerList(interaction.client, interaction.guildId);
      await require('../commands/partner').sendLog(interaction.client, interaction.guildId, `🗑️ Partner Removed`, `**${partner.name}** removed by <@${interaction.user.id}>`);
      return;
    }
    if (id === 'partner_cancel_remove') {
      return interaction.update({ ...require('../ui').successCard('Removal cancelled.'), components: [] });
    }
  }
}
