const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test-style')
    .setDescription('Preview the message style.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.reply({ content: '✅ Sending preview...', ephemeral: true });

    await interaction.channel.send(
      `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
      `☕  **ROASTIN COFFEE**  |  *Partnership System*\n` +
      `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` +
      `🤝  **New Partner — Example Group**\n\n` +
      `> 👤  **Representative:** <@${interaction.user.id}>\n` +
      `> 🔗  **Roblox Group:** [Click here](https://www.roblox.com/groups/1)\n` +
      `> 💬  **Discord:** [Join Server](https://discord.gg/example)\n` +
      `> 📅  **Since:** ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}\n\n` +
      `▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
      `*Roastin Coffee PR System  •  ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}*`
    );
  },
};
