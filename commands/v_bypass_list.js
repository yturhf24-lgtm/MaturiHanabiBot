const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_bypass_list')
    .setDescription('【管理者専用】このサーバーで裏アカウントを許可されているプレイヤー一覧を表示します。')
    // 🛑 管理者権限（Administrator）を持たないユーザーにはコマンドの使用・表示を一切禁止する
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 💡 DMでのコマンド実行を防ぐ（サーバー内限定）
    .setDMPermission(false),

  async execute(interaction) {
    // 🛑 二重チェック: 許可ロール等を付与された一般ユーザーの実行を完全にシャットアウト
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ 
        content: '❌ このコマンドはサーバーの最高管理者（管理者権限を付与されたロール）のみ実行可能です。許可ロール等では使用できません。', 
        ephemeral: true 
      });
    }

    const guildId = interaction.guildId;
    const client = interaction.client;
    const allSettings = client.getSettings();

    const bypassList = allSettings[guildId]?.bypassUsers || [];

    const embed = new EmbedBuilder()
      .setTitle('📋 裏アカウント例外許可プレイヤー一覧')
      .setColor(0x3498db)
      .setTimestamp();

    if (bypassList.length === 0) {
      embed.setDescription('現在、このサーバーで例外許可されているプレイヤーはいません。');
    } else {
      const mentions = bypassList.map(id => `• <@${id}> (\`${id}\`)`).join('\n');
      embed.setDescription(`以下のプレイヤーは同一IPチェック（裏垢制限）を免除されています：\n\n${mentions}`);
    }

    return interaction.reply({ embeds: [embed] });
  }
};
