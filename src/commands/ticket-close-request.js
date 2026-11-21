'use strict';
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Ticket = require('../models/Ticket');
const GuildConfig = require('../models/GuildConfig');
const { successCard, errorCard } = require('../ui');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket-close-request')
    .setDescription('Send close request for a ticket.')
    .addStringOption(o => o.setName('reason').setDescription('Grund (optional)').setRequired(false)),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const { guild, channel } = interaction;
    const cfg = await GuildConfig.findOne({ guildId: guild.id });
    if (!isStaff(interaction.member, cfg)) return interaction.editReply(errorCard('Staff only.'));

    const ticket = await Ticket.findOne({ guildId: guild.id, channelId: channel.id, status: 'open' });
    if (!ticket) return interaction.editReply(errorCard('No open ticket.'));

    if (ticket.closeRequestedAt) return interaction.editReply(errorCard('Close request already open.'));

    const reason = interaction.options.getString('reason');
    const closeRequestHours = cfg?.automation?.ticketCloseRequestHours ?? 24;
    const closeAt = new Date(Date.now() + closeRequestHours * 60 * 60 * 1000);

    await Ticket.findByIdAndUpdate(ticket._id, {
      closeRequestedAt: new Date(),
      closeRequestedBy: interaction.user.id,
      closeRequestReason: reason,
    });

    const cardPayload = require('../ui').card({
      title: '🔒 Close Request',
      description: `A staff member has requested to close this ticket.\\n\\n**Requested by:** <@${interaction.user.id}>${reason ? `\\n**Reason:** ${reason}` : ''}\\n\\nWill be auto-closed <t:${Math.floor(closeAt.getTime() / 1000)}:R> if no response.`,
      color: require('../theme').COLORS.warning,
      buttons: [
        new (require('discord.js').ButtonBuilder)().setCustomId(`ticket_agree_close:${ticket._id}`).setLabel('Close').setStyle(require('discord.js').ButtonStyle.Danger),
        new (require('discord.js').ButtonBuilder)().setCustomId(`ticket_keep_open:${ticket._id}`).setLabel('Keep Open').setStyle(require('discord.js').ButtonStyle.Secondary),
      ],
      ephemeral: false,
    });

    const msg = await channel.send(cardPayload).catch(() => null);
    if (msg) await Ticket.findByIdAndUpdate(ticket._id, { closeRequestMessageId: msg.id });

    await channel.send({ content: `<@${ticket.userId}>`, allowedMentions: { users: [ticket.userId] } }).catch(() => {});

    await require('../utils/audit').audit(guild.id, interaction.user.id, 'ticket_close_request', 'ticket', ticket._id.toString(), { reason });
    await interaction.editReply(successCard('Close-Request sent.'));
  },
};
