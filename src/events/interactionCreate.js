module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
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
    }

    if (interaction.isButton()) {
      const [action] = interaction.customId.split(':');

      if (action === 'review_confirm') {
        const { handleReviewConfirm } = require('../commands/review');
        await handleReviewConfirm(interaction);
      }

      if (action === 'event_approve' || action === 'event_deny') {
        const { handleEventDecision } = require('../commands/event-request');
        await handleEventDecision(interaction);
      }

      if (action === 'ticket_apply' || action === 'ticket_inquiry') {
        const { handleTicketOpen } = require('../commands/ticket-panel');
        await handleTicketOpen(interaction);
      }
    }
  },
};
