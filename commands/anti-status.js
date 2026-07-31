const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anti-status')
    .setDescription('【特別ユーザー・サーバーオーナー専用】現在のすべての荒らし対策設定を確認します'),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    if (interaction.user.id !== SPECIAL_USER_ID && interaction.guild?.ownerId !== interaction.user.id) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('権限がありません。')] });
    }

    const guildId = interaction.guildId;
    const settings = client.getSettings();
    const guildSettings = settings[guildId] || {};

    const invite = guildSettings.antiInvite || { enabled: false };
    const avatar = guildSettings.antiDefaultAvatar || { enabled: false };
    const newAccount = guildSettings.antiNewAccount || { enabled: false };
    const spamMsg = guildSettings.antiSpamMsg || { enabled: false };

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('🛡️ 現在の荒らし対策 設定一覧')
      .addFields(
        {
          name: '1. 招待リンク連投対策 (`/anti-invite`)',
          value: `状態: **${invite.enabled ? '🟢 ON' : '🔴 OFF'}**\nログチャンネル: ${invite.logChannelId ? `<#${invite.logChannelId}>` : '未設定'}\nタイムアウト: ${invite.timeoutMinutes || 10}分`,
          inline: false
        },
        {
          name: '2. 初期アイコン対策 (`/anti-default-avatar`)',
          value: `状態: **${avatar.enabled ? '🟢 ON' : '🔴 OFF'}**\nログチャンネル: ${avatar.logChannelId ? `<#${avatar.logChannelId}>` : '未設定'}\nKick実行: ${avatar.kick ? '有効' : '無効'}`,
          inline: false
        },
        {
          name: '3. 新規アカウント対策 (`/anti-new-account`)',
          value: `状態: **${newAccount.enabled ? '🟢 ON' : '🔴 OFF'}**\n対象日数: ${newAccount.minDays || 0}日以上 〜 ${newAccount.maxDays || 0}日未満\nログチャンネル: ${newAccount.logChannelId ? `<#${newAccount.logChannelId}>` : '未設定'}`,
          inline: false
        },
        {
          name: '4. メッセージスパム対策 (`/anti-spam-message`)',
          value: `状態: **${spamMsg.enabled ? '🟢 ON' : '🔴 OFF'}**\n条件: ${spamMsg.seconds || 0}秒以内に${spamMsg.count || 0}回\n処置: ${spamMsg.action || 'なし'}\nログチャンネル: ${spamMsg.logChannelId ? `<#${spamMsg.logChannelId}>` : '未設定'}`,
          inline: false
        }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
