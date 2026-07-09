const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log-status')
    .setDescription('現在のオリジナルメッセージ設定を特大文字で確認します（あなたにしか見えません）'),

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

    // 💡 あなたにしか見えない「シークレット返信」
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const config = settings[interaction.guildId] || {};
    const channelId = config.logChannel;
    const joinMsg = config.joinMessage || '**{user}** がサーバーに参加しました！';
    const leaveMsg = config.leaveMessage || '**{user}** がサーバーから退出しました。';

    const embed = new EmbedBuilder()
      .setColor(0x00FFFF)
      .setTitle('📋 設定中のオリジナル文字確認')
      .setDescription(`📢 **現在のログ通知先チャンネル**: ${channelId ? `<#${channelId}>` : '` ❌ 未設定 `\n'}`)
      .addFields(
        // 💡 参加・退出のオリジナルテキストだけを # を使って特大表示させています
        { name: '📥 【設定中の参加オリジナル文字】', value: `# ${joinMsg}`, inline: false },
        { name: '📤 【設定中の退出オリジナル文字】', value: `# ${leaveMsg}`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: 'PRIVATE INTERFACE // YOU ONLY' });

    await interaction.editReply({ embeds: [embed] });
  },
};
