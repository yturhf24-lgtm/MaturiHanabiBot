const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log-status')
    .setDescription('現在のオリジナルメッセージやログ設定の画面UIを表示します'),

  async execute(interaction) {
    const isMasterUser = interaction.user.id === MASTER_USER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];
    const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!isMasterUser && !isAdmin && !hasAllowedRole) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('このコマンドを使用する権限がありません。')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    // 画面上に全員が見える形で表示させるため、普通にシグナル待機
    await interaction.deferReply();

    const config = settings[interaction.guildId] || {};
    const channelId = config.logChannel;
    const joinMsg = config.joinMessage || '**{user}** がサーバーに参加しました！';
    const leaveMsg = config.leaveMessage || '**{user}** がサーバーから退出しました。';
    const rebootChannelId = config.rebootChannel;
    const rebootStatus = config.rebootStatus ? '🟢 ON' : '🔴 OFF';

    const embed = new EmbedBuilder()
      .setColor(0x2F3136)
      .setTitle('🖥️ LOG SYSTEM INTERFACE PANEL')
      .setDescription('現在のログサーバー稼働状況およびオリジナル文字の設定画面UIです。')
      .addFields(
        { name: '📺 メインログチャンネル', value: channelId ? `<#${channelId}>` : '` ❌ 未設定 (通知オフ) `', inline: true },
        { name: '🔄 再起動ログ通知設定', value: rebootChannelId ? `<#${rebootChannelId}> [${rebootStatus}]` : '` ❌ 未設定 `', inline: true },
        { name: '📥 設定中のオリジナル参加文字', value: `\`\`\`${joinMsg}\`\`\``, inline: false },
        { name: '📤 設定中のオリジナル退出文字', value: `\`\`\`${leaveMsg}\`\`\``, inline: false },
        { name: '📅 収集データ①: アカウント作成日', value: '` 🟢 自動解析有効 ` (Discord標準タイムスタンプ形式に自動変換して埋め込み出力)', inline: false },
        { name: '🔗 収集データ②: 使用された招待リンク', value: '` 🟢 追跡システム有効 ` (作成者・URL・使用回数を自動特定して埋め込み出力)', inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'SYSTEM INTERFACE // DATA VISUALIZATION' });

    await interaction.editReply({ embeds: [embed] });
  },
};
