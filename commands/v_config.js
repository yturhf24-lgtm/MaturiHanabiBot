const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_config')
    .setDescription('現在のサーバーの全設定一覧を表示します。')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const config = interaction.client.getSettings()[interaction.guildId] || {};
    const antiSpam = config.antiSpam || { enabled: false };

    const embed = new EmbedBuilder()
      .setTitle('⚙️ サーバー設定一覧')
      .setColor(0x3b82f6)
      .addFields(
        { name: '📋 ログチャンネル', value: config.vLogChannel ? `<#${config.vLogChannel}>` : '未設定', inline: true },
        { name: '🔔 ログ機能', value: config.vLogStatus ? '有効 (ON)' : '無効 (OFF)', inline: true },
        { name: '🛡️ スパム保護', value: antiSpam.enabled ? `${antiSpam.seconds}秒間に${antiSpam.maxMessages}投稿 ➔ ${antiSpam.action}` : 'OFF', inline: false }
      );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
