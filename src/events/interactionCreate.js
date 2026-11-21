'use strict';
const { MessageFlags } = require('discord.js');
const { errorCard, successCard } = require('../ui');
const { ts } = require('../utils/format');

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

    // Permission check (B1)
    const ACCESS_MAP = {
      setup: 'ADMIN', config: 'ADMIN', dweeb: 'ADMIN',
      partner: 'STAFF', infraction: 'STAFF', review: 'STAFF',
      ticket: 'STAFF', 'event-request': 'PUBLIC',
      stats: 'STAFF', audit: 'STAFF', doctor: 'STAFF',
    };
    const access = ACCESS_MAP[interaction.commandName] || 'PUBLIC';
    if (access !== 'PUBLIC') {
      const cfg = await (require('../models/GuildConfig')).findOne({ guildId: interaction.guildId }).catch(() => null);
      const { requireLevel } = require('../utils/permissions');
      const ok = await requireLevel(interaction, access, client);
      if (!ok) return;
    }

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
    if (id.startsWith('ticket_staff_close:')) {
      return require('../commands/ticket-panel').handleTicketStaffClose(interaction);
    }
    if (id.startsWith('review_submit:')) {
      return require('../commands/review').handleReviewSubmit(interaction);
    }
    if (id.startsWith('event_deny_reason:')) {
      return require('../commands/event-request').handleEventDenyModal(interaction);
    }
    if (id.startsWith('cfg_text_modal:') || id === 'cfg_reviewLink_modal' || id === 'cfg_reviewQuestions_modal' || id.startsWith('cfg_auto_value:')) {
      return require('../commands/config').handleConfigInteraction(interaction);
    }
    if (id.startsWith('ticket_rate_feedback:')) {
      return require('../commands/ticket-panel').handleTicketRateFeedbackModal(interaction);
    }
    if (id.startsWith('infraction_appeal_submit:')) {
      return require('../commands/infraction').handleInfractionAppealSubmit(interaction);
    }
    if (id.startsWith('appeal_reject_reason:')) {
      return require('../commands/infraction').handleAppealRejectReason(interaction);
    }
    return;
  }

  // ── Config interactions (selects + buttons) ─────────────────────────────────
  const { handleConfigInteraction } = require('../commands/config');
  const cfgIds = ['cfg_category', 'cfg_ch_pick', 'cfg_reviewMode', 'cfg_text_pick', 'cfg_auto_pick'];
  const cfgChannelIds = id => id?.startsWith('cfg_channel:') || id === 'cfg_ticketCategory';
  const cfgRoleIds    = ['cfg_adminRoles', 'cfg_prStaffRoles', 'cfg_partnerRepRoles'];
  const cfgButtonIds  = ['cfg_back', 'cfg_setReviewLink', 'cfg_setReviewQuestions'];

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

    // Setup wizard buttons
    if (id.startsWith('setup:')) {
      const parts = id.split(':');
      const step = parts[1];
      const action = parts[2];
      await interaction.deferUpdate().catch(() => {});
      // Simple navigation: just re-run setup start
      const { execute } = require('../commands/setup');
      await execute(interaction).catch(err => console.error('[setup]', err));
      return;
    }

    // Pagination: page:<ctx>:<prev|next>:<page>
    if (id.startsWith('page:')) {
      const parts = id.split(':'); // page, ctx, prev|next, page
      const dir   = parts[2];
      const cur   = parseInt(parts[3], 10);
      const next  = dir === 'next' ? cur + 1 : cur - 1;

      const ctxParts = parts[1].split(':'); // ctx may contain ':' for infractions:<id>
      // Reconstruct: parts[1] is everything between 'page:' and ':prev' or ':next'
      // Format: page:<ctx>:<dir>:<page> where ctx can contain ':'
      const ctxTail = id.slice(5); // everything after 'page:'
      const lastColon = ctxTail.lastIndexOf(':');
      const secondLastColon = ctxTail.lastIndexOf(':', lastColon - 1);
      const ctx = ctxTail.slice(0, secondLastColon);
      const pageNum = parseInt(ctxTail.slice(lastColon + 1), 10);
      const direction = ctxTail.slice(secondLastColon + 1, lastColon);

      const targetPage = direction === 'next' ? pageNum + 1 : pageNum - 1;

      if (ctx === 'partners') {
        const Partner = require('../models/Partner');
        const { partnerListCards, infoCard } = require('../ui');
        const { EMOJI, PAGE_SIZE } = require('../theme');
        const { paginate } = require('../utils/pagination');
        const all = await Partner.find({ guildId: interaction.guildId });
        if (!all.length) return interaction.update(errorCard('No partners found.'));
        const { items, totalPages, page, row } = paginate(all, targetPage, PAGE_SIZE, 'partners');
        let desc = `**${all.length} active partner(s)**\n\n`;
        for (const pt of items) {
          desc += `**${pt.name}** — <@${pt.representativeId}>\n> Since ${ts(pt.addedAt, 'D')}\n\n`;
        }
        if (totalPages > 1) desc += `-# Page ${page + 1}/${totalPages}`;
        const res = infoCard(`${EMOJI.partner} Partner List`, desc, true);
        if (row) res.components = [...res.components, row];
        return interaction.update(res);
      }

      if (ctx.startsWith('infractions:')) {
        const partnerId = ctx.split(':')[1];
        const Partner = require('../models/Partner');
        const Infraction = require('../models/Infraction');
        const { infractionListCard, errorCard } = require('../ui');
        const { STRIKE_LIMIT, PAGE_SIZE } = require('../theme');
        const { paginate } = require('../utils/pagination');
        const partner = await Partner.findOne({ _id: partnerId, guildId: interaction.guildId });
        if (!partner) return interaction.update(errorCard('Partner not found.'));
        const all = await Infraction.find({ guildId: interaction.guildId, partnerId, removed: false });
        const strikes = all.filter(i => i.type === 'strike').length;
        const { items, totalPages, page, row } = paginate(all, targetPage, PAGE_SIZE, `infractions:${partnerId}`);
        const res = infractionListCard(partner, items, page, totalPages, strikes, STRIKE_LIMIT);
        if (row) res.components = [...res.components, row];
        return interaction.update(res);
      }

      return interaction.update(errorCard('Unknown pagination context.'));
    }

    if (id.startsWith('audit_prev:') || id.startsWith('audit_next:')) {
      return require('../commands/audit').handleAuditPagination(interaction, id.startsWith('audit_next:') ? 'next' : 'prev');
    }
    if (id.startsWith('ticket_open:'))          return require('../commands/ticket-panel').handleTicketOpen(interaction);
    if (id === 'ticket_close')                  return require('../commands/ticket-panel').handleTicketClose(interaction);
    if (id === 'ticket_close_request')             return require('../commands/ticket-panel').handleTicketCloseRequest(interaction);
    if (id === 'ticket_claim')                  return require('../commands/ticket-panel').handleTicketClaim(interaction);
    if (id.startsWith('review_start:'))         return require('../commands/review').handleReviewStart(interaction);
    if (id.startsWith('event_approve:') || id.startsWith('event_deny:')) {
      return require('../commands/event-request').handleEventDecision(interaction);
    }
    if (id.startsWith('partner_confirm_remove:')) {
      return require('../commands/partner').handlePartnerRemoveConfirm(interaction);
    }
    if (id === 'partner_cancel_remove') {
      return interaction.update(successCard('Removal cancelled.'));
    }
    if (id === 'ticket_release') return require('../commands/ticket-panel').handleTicketRelease(interaction);
    if (id.startsWith('ticket_rate:')) return require('../commands/ticket-panel').handleTicketRate(interaction);
    if (id.startsWith('infraction_appeal:')) {
      return require('../commands/infraction').handleInfractionAppeal(interaction);
    }
    if (id.startsWith('infraction_terminate:') || id.startsWith('infraction_dismiss:')) {
      return require('../commands/infraction').handleInfractionEscalationDecision(interaction);
    }
    if (id.startsWith('appeal_accept:') || id.startsWith('appeal_reject:')) {
      return require('../commands/infraction').handleAppealDecision(interaction);
    }
    if (id.startsWith('ticket_confirm_close:')) return require('../commands/ticket-panel').handleTicketConfirmClose(interaction);
    if (id === 'ticket_cancel_close')           return require('../commands/ticket-panel').handleTicketCancelClose(interaction);
    if (id.startsWith('ticket_keep_open:'))     return require('../commands/ticket-panel').handleTicketKeepOpen(interaction);
    if (id.startsWith('ticket_agree_close:'))   return require('../commands/ticket-panel').handleTicketAgreeClose(interaction);
    if (id.startsWith('event_interest:')) {
      return require('../commands/event-request').handleEventInterest(interaction);
    }

    // Unknown customId
    return interaction.reply({ content: 'This button is outdated.', ephemeral: true }).catch(() => {});
  }
}
