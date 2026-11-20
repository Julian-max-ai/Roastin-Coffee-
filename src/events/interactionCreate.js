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

    // Config interactions (buttons, selects, modals)
    const { handleConfigInteraction } = require('../commands/config');
    const configTriggers = ['cfg_category', 'cfg_ch_pick', 'cfg_reviewMode', 'cfg_text_pick', 'cfg_back', 'cfg_setReviewLink', 'cfg_reviewLink_modal'];
    const isConfigInteraction =
      (interaction.isStringSelectMenu() && configTriggers.includes(interaction.customId)) ||
      (interaction.isChannelSelectMenu() && (interaction.customId.startsWith('cfg_channel:') || interaction.customId === 'cfg_ticketCategory')) ||
      (interaction.isRoleSelectMenu() && ['cfg_prStaffRoles', 'cfg_partnerRepRoles'].includes(interaction.customId)) ||
      (interaction.isButton() && ['cfg_back', 'cfg_setReviewLink'].includes(interaction.customId)) ||
      (interaction.isModalSubmit() && (interaction.customId.startsWith('cfg_text_modal:') || interaction.customId === 'cfg_reviewLink_modal'));

    if (isConfigInteraction) return handleConfigInteraction(interaction);

    // Buttons
    if (interaction.isButton()) {
      const [action, ...rest] = interaction.customId.split(':');

      if (action === 'review_start') {
        const { handleReviewStart } = require('../commands/review');
        return handleReviewStart(interaction);
      }

      if (action === 'event_approve' || action === 'event_deny') {
        const { handleEventDecision } = require('../commands/event-request');
        return handleEventDecision(interaction);
      }

      if (action === 'ticket_open') {
        const { handleTicketOpen } = require('../commands/ticket-panel');
        return handleTicketOpen(interaction, rest[0]);
      }
    }

    // Select menus
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select') {
      const { handleTicketOpen } = require('../commands/ticket-panel');
      return handleTicketOpen(interaction, interaction.values[0]);
    }

    // Dweeb modal
    if (interaction.isModalSubmit() && interaction.customId.startsWith('dweeb_send:')) {
      const { handleDweebModal } = require('../commands/dweeb');
      return handleDweebModal(interaction);
    }
  },
};

