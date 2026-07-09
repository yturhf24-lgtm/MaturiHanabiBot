const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log-status')
    .setDescription('参加・退出ログ設定のコントロールパネルUIを表示します'),

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

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const config = settings[interaction.guildId] || {};
    const channelId = config.logChannel;
    const joinMsg = config.joinMessage || '**{user}** がサーバーに参加しました！';
    const leaveMsg = config.leaveMessage || '**{user}** がサーバーから退出しました。';
    const rebootChannelId = config.rebootChannel;
    const rebootStatus = config.rebootStatus ? '🟢 ON' : '🔴 OFF';

    const embed = new EmbedBuilder()
      .setColor(0x2F3136)
      .setTitle('⚙️ LOG SYSTEM CONTROL PANEL')
      .setDescription('システム設定およびコンポーネントの操作画面です。下の物理ボタンから直接命令を下せます。')
      .addFields(
        { name: '📺 メインログチャンネル', value: channelId ? `<#${channelId}>` : '` ❌ 未設定 (通知オフ) `', inline: true },
        { name: '🔄 再起動ログ通知設定', value: rebootChannelId ? `<#${rebootChannelId}> [${rebootStatus}]` : '` ❌ 未設定 `', inline: true },
        { name: '📥 参加メッセージ構成案', value: `\`\`\`${joinMsg}\`\`\``, inline: false },
        { name: '📤 退出メッセージ構成案', value: `\`\`\`${leaveMsg}\`\`\``, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'DEVICE INTERFACE // SYSTEM CONTROL' });

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('ui_test_join')
          .setLabel('参加通知をテスト送信')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('ui_test_leave')
          .setLabel('退出通知をテスト送信')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('ui_system_reset')
          .setLabel('設定一括初期化')
          .setStyle(ButtonStyle.Secondary)
      );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
