const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure the PR bot settings for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('announcement-channel')
      .setDescription('Set the announcement channel.')
      .addChannelOption(o => o.setName('channel').setDescription('Announcement channel').setRequired(true)
        .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub => sub
      .setName('review-channel')
      .setDescription('Set the monthly review channel.')
      .addChannelOption(o => o.setName('channel').setDescription('Review channel').setRequired(true)
        .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub => sub
      .setName('log-channel')
      .setDescription('Set the log channel.')
      .addChannelOption(o => o.setName('channel').setDescription('Log channel').setRequired(true)
        .addChannelTypes(ChannelType.GuildText)))
    .addSubcommand(sub => sub
      .setName('ticket-category')
      .setDescription('Set the ticket category.')
      .addChannelOption(o => o.setName('category').setDescription('Ticket category').setRequired(true)
        .addChannelTypes(ChannelType.GuildCategory)))
    .addSubcommand(sub => sub
      .setName('pr-staff-role')
      .setDescription('Set the PR staff role.')
      .addRoleOption(o => o.setName('role').setDescription('PR Staff role').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('partner-rep-role')
      .setDescription('Set the partner representative role.')
      .addRoleOption(o => o.setName('role').setDescription('Partner Representative role').setRequired(true)))
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View current configuration.')),

  async execute(interaction) {
    const { guildId } = interaction;
    const sub = interaction.options.getSubcommand();

    if (sub === 'view') {
      const cfg = await GuildConfig.findOne({ guildId }) || {};
      const embed = new EmbedBuilder()
        .setColor(0x6F4E37)
        .setTitle('⚙️ Roastin Coffee — Server Configuration')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .addFields(
          { name: '📢 Announcement Channel', value: cfg.announcementChannel ? `<#${cfg.announcementChannel}>` : '*Not set*', inline: true },
          { name: '📋 Review Channel', value: cfg.reviewChannel ? `<#${cfg.reviewChannel}>` : '*Not set*', inline: true },
          { name: '📝 Log Channel', value: cfg.logChannel ? `<#${cfg.logChannel}>` : '*Not set*', inline: true },
          { name: '🎫 Ticket Category', value: cfg.ticketCategory ? `<#${cfg.ticketCategory}>` : '*Not set*', inline: true },
          { name: '👔 PR Staff Role', value: cfg.prStaffRole ? `<@&${cfg.prStaffRole}>` : '*Not set*', inline: true },
          { name: '🤝 Partner Rep Role', value: cfg.partnerRepRole ? `<@&${cfg.partnerRepRole}>` : '*Not set*', inline: true },
        )
        .setFooter({ text: 'Roastin Coffee PR System' })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const updates = {
      'announcement-channel': () => ({ announcementChannel: interaction.options.getChannel('channel').id }),
      'review-channel':       () => ({ reviewChannel: interaction.options.getChannel('channel').id }),
      'log-channel':          () => ({ logChannel: interaction.options.getChannel('channel').id }),
      'ticket-category':      () => ({ ticketCategory: interaction.options.getChannel('category').id }),
      'pr-staff-role':        () => ({ prStaffRole: interaction.options.getRole('role').id }),
      'partner-rep-role':     () => ({ partnerRepRole: interaction.options.getRole('role').id }),
    };

    const labels = {
      'announcement-channel': 'Announcement Channel',
      'review-channel':       'Monthly Review Channel',
      'log-channel':          'Log Channel',
      'ticket-category':      'Ticket Category',
      'pr-staff-role':        'PR Staff Role',
      'partner-rep-role':     'Partner Representative Role',
    };

    await GuildConfig.findOneAndUpdate({ guildId }, updates[sub](), { upsert: true, new: true });

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Configuration Updated')
      .setDescription(`**${labels[sub]}** has been updated.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
