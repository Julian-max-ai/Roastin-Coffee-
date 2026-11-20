module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {

    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(err);
        const msg = { content: '❌ An error occurred.', ephemeral: true };
        interaction.replied || interaction.deferred ? await interaction.followUp(msg) : await interaction.reply(msg);
      }
      return;
    }

    // Autocomplete
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) await command.autocomplete(interaction).catch(console.error);
      return;
    }

    // Modal submits
    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('dweeb_send:') || interaction.customId.startsWith('dweeb_edit:')) {
        const { handleDweebModal } = require('../commands/dweeb');
        return handleDweebModal(interaction);
      }
      if (interaction.customId.startsWith('ticket_edit:')) {
        const { handleTicketEditModal } = require('../commands/ticket-panel');
        return handleTicketEditModal(interaction);
      }
      if (interaction.customId.startsWith('cfg_text_modal:') || interaction.customId === 'cfg_reviewLink_modal') {
        const { handleConfigInteraction } = require('../commands/config');
        return handleConfigInteraction(interaction);
      }
      return;
    }

    // Config interactions
    const { handleConfigInteraction } = require('../commands/config');
    const isConfigInteraction =
      (interaction.isStringSelectMenu() && ['cfg_category', 'cfg_ch_pick', 'cfg_reviewMode', 'cfg_text_pick'].includes(interaction.customId)) ||
      (interaction.isChannelSelectMenu() && (interaction.customId.startsWith('cfg_channel:') || interaction.customId === 'cfg_ticketCategory')) ||
      (interaction.isRoleSelectMenu() && ['cfg_prStaffRoles', 'cfg_partnerRepRoles'].includes(interaction.customId)) ||
      (interaction.isButton() && ['cfg_back', 'cfg_setReviewLink'].includes(interaction.customId));

    if (isConfigInteraction) return handleConfigInteraction(interaction);

    // Buttons
    if (interaction.isButton()) {
      const customId = interaction.customId;

      if (customId.startsWith('ticket_open:')) {
        const { handleTicketOpen } = require('../commands/ticket-panel');
        return handleTicketOpen(interaction);
      }

      if (customId.startsWith('review_start:')) {
        const { handleReviewStart } = require('../commands/review');
        return handleReviewStart(interaction);
      }

      if (customId.startsWith('event_approve:') || customId.startsWith('event_deny:')) {
        const { handleEventDecision } = require('../commands/event-request');
        return handleEventDecision(interaction);
      }
    }

    // Select menus
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
      const { handleTicketOpen } = require('../commands/ticket-panel');
      return handleTicketOpen(interaction);
    }
  },
};
