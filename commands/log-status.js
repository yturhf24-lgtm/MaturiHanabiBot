const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log-status')
    .setDescription('現在の参加・退出ログ設定（ダッシュボードUI）を確認します'),

  async execute(interaction) {
    const isMasterUser = interaction.user.id === MASTER_USER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];
    const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!isMasterUser && !isAdmin && !hasAllowedRole) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('このコマンドを使用する権限がありません。')],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const config = settings[interaction.guildId];
    const channelId = config?.logChannel;
    const joinMsg = config?.joinMessage || '**{user}** がサーバーに参加しました！';
    const leaveMsg = config?.leaveMessage || '**{user}** がサーバーから退出しました。';

    const embed = new EmbedBuilder()
      .setColor(channelId ? 0x00FFFF : 0x777777)
      .setTitle('🖥️ LOG SYSTEM CONFIGURATION PANEL')
      .setDescription('現在のログサーバー稼働状況とデザイン設定UIです。')
      .addFields(
        { name: '🟢 システムステータス', value: channelId ? '` 稼働中 (ONLINE) `' : '` 未設定 (OFFLINE) `', inline: true },
        { name: '📺 ログ送信先チャンネル', value: channelId ? `<#${channelId}>` : '` 未設定 `', inline: true },
        { name: '📥 参加メッセージテンプレート', value: `\`\`\`${joinMsg}\`\`\``, inline: false },
        { name: '📤 退出メッセージテンプレート', value: `\`\`\`${leaveMsg}\`\`\``, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `要求者: ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
  },
};
