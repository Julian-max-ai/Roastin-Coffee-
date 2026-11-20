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
        interaction.replied || interaction.deferred
          ? await interaction.followUp(msg)
          : await interaction.reply(msg);
      }
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      const [action] = interaction.customId.split(':');

      if (interaction.customId.startsWith('cfg_') && !interaction.customId.startsWith('cfg_select:')) {
        const { handleConfigButton } = require('../commands/config');
        return handleConfigButton(interaction);
      }

      if (action === 'review_confirm') {
        const { handleReviewConfirm } = require('../commands/review');
        return handleReviewConfirm(interaction);
      }

      if (action === 'event_approve' || action === 'event_deny') {
        const { handleEventDecision } = require('../commands/event-request');
        return handleEventDecision(interaction);
      }

      if (action === 'ticket_apply' || action === 'ticket_inquiry') {
        const { handleTicketOpen } = require('../commands/ticket-panel');
        return handleTicketOpen(interaction);
      }
    }

    // Select menus
    if (interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
      if (interaction.customId.startsWith('cfg_select:')) {
        const { handleConfigSelect } = require('../commands/config');
        return handleConfigSelect(interaction);
      }
    }
  },
};
