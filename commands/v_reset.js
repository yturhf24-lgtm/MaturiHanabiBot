const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_reset')
    .setDescription('【管理者専用】特定のユーザーのレート制限・裏垢ブロックをサーバー個別に解除します')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(opt => 
      opt.setName('user')
        .setDescription('制限を解除したい対象ユーザーを選択してください')
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const guildId = interaction.guildId;
    const allSettings = interaction.client.getSettings();

    // サーバーのデータ引き出しが存在するか、またはブロックリストがあるかチェック
    if (!allSettings[guildId] || !allSettings[guildId].blockedUsers || Object.keys(allSettings[guildId].blockedUsers).length === 0) {
      return interaction.reply({ 
        content: '❌ このサーバーには現在、システムによってブロックされているユーザーはいません。', 
        flags: [MessageFlags.Ephemeral] 
      });
    }

    // 対象ユーザーがこのサーバーのブロックリストに載っているか判定
    if (allSettings[guildId].blockedUsers[targetUser.id]) {
      // 載っていればそのサーバーの引き出しからのみ削除
      delete allSettings[guildId].blockedUsers[targetUser.id];
      
      // GitHubおよびローカルjsonに自動同期（他サーバーのデータは一切壊れません）
      await interaction.client.saveSettings(allSettings);

      return interaction.reply({
        content: `✅ ユーザー **${targetUser.tag}** の制限を個別リセットしました。該当ユーザーは再度認証を試みることができます。`,
        flags: [MessageFlags.Ephemeral]
      });
    } else {
      return interaction.reply({
        content: `⚠️ 対象ユーザー（${targetUser.username}）は、このサーバーのブロックリストに登録されていません。`,
        flags: [MessageFlags.Ephemeral]
      });
    }
  }
};
