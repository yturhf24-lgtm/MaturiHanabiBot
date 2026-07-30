const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botの応答速度を確認します（許可ロール・管理者専用）'),

  async execute(interaction) {
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];

    const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
    const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
    const hasAllowedRole = interaction.member?.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!isSpecialUser && !isAdmin && !hasAllowedRole) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 実行権限がありません')
            .setDescription('このコマンドを実行するには、許可されたロールまたは管理者権限が必要です。')
        ],
        flags: [MessageFlags.Ephemeral]
      });
    }

    await interaction.reply({
      content: `🏓 Pong! レイテンシ: ${interaction.client.ws.ping}ms`,
      flags: [MessageFlags.Ephemeral]
    });
  }
};
