const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configure the PR bot settings for this server.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub
      .setName('set')
      .setDescription('Set a configuration value.')
      .addStringOption(opt => opt
        .setName('key')
        .setDescription('Setting to configure')
        .setRequired(true)
        .addChoices(
          { name: 'Announcement Channel', value: 'announcementChannel' },
          { name: 'Monthly Review Channel', value: 'reviewChannel' },
          { name: 'Log Channel', value: 'logChannel' },
          { name: 'Ticket Category', value: 'ticketCategory' },
          { name: 'PR Staff Role', value: 'prStaffRole' },
          { name: 'Partner Representative Role', value: 'partnerRepRole' },
        ))
      .addStringOption(opt => opt
        .setName('value')
        .setDescription('Channel ID, Category ID, or Role ID')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('view')
      .setDescription('View current configuration.')),

  async execute(interaction) {
    const { guildId } = interaction;

    if (interaction.options.getSubcommand() === 'view') {
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

    // set subcommand
    const key = interaction.options.getString('key');
    const value = interaction.options.getString('value');

    await GuildConfig.findOneAndUpdate(
      { guildId },
      { [key]: value },
      { upsert: true, new: true }
    );

    const labels = {
      announcementChannel: 'Announcement Channel',
      reviewChannel: 'Monthly Review Channel',
      logChannel: 'Log Channel',
      ticketCategory: 'Ticket Category',
      prStaffRole: 'PR Staff Role',
      partnerRepRole: 'Partner Representative Role',
    };

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ Configuration Updated')
      .setDescription(`**${labels[key]}** has been set to \`${value}\`.`)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
