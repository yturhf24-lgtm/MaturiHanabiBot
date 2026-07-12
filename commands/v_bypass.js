const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_bypass')
    .setDescription('【管理・スタッフ用】裏アカウント検知の例外許可（バイパス）を設定・解除します。')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    .addUserOption(option =>
      option.setName('target')
        .setDescription('対象のユーザーを選択')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('action')
        .setDescription('実行する操作を選択')
        .setRequired(true)
        .addChoices(
          { name: '🟢 例外許可に追加（ブロック解除）', value: 'add' },
          { name: '🔴 例外許可から削除（通常通り検知）', value: 'remove' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const guildId = interaction.guildId;
    const client = interaction.client;
    const allSettings = client.getSettings();
    const config = allSettings[guildId] || {};

    // 🛑 権限チェック
    const isAdministrator = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const hasPermitRole = config.vPermitRole ? interaction.member.roles.cache.has(config.vPermitRole) : false;

    if (!isAdministrator && !hasPermitRole) {
      return interaction.editReply({ 
        content: '❌ このコマンドを実行する権限がありません。'
      });
    }

    const targetUser = interaction.options.getUser('target');
    const action = interaction.options.getString('action');

    if (!config.bypassUsers) config.bypassUsers = [];
    if (!config.verifiedIps) config.verifiedIps = {};
    if (!config.blockedUsers) config.blockedUsers = {};

    // ==========================================
    // 🟢 ACTION: ADD (例外許可に追加 ＆ ブロックデータ削除)
    // ==========================================
    if (action === 'add') {
      // すでに登録されているかチェック
      if (!config.bypassUsers.includes(targetUser.id)) {
        config.bypassUsers.push(targetUser.id);
      }

      // ウェブサイト(index.js)で裏垢判定されたブロックデータを自動解除
      if (config.blockedUsers[targetUser.id]) {
        delete config.blockedUsers[targetUser.id];
      }

      // 同期元のIPデータ側にもし残っていればそれも削除して次から認証を通す
      let foundIp = null;
      for (const [ip, userId] of Object.entries(config.verifiedIps)) {
        if (userId === targetUser.id) {
          foundIp = ip;
          break;
        }
      }
      if (foundIp) {
        delete config.verifiedIps[foundIp];
      }

      allSettings[guildId] = config;
      await client.saveSettings(allSettings);

      return interaction.editReply({
        content: `🟢 <@${targetUser.id}> を**例外許可リストに追加**し、裏垢ブロック状態を解除しました。次回から正常に認証可能です。`
      });
    }

    // ==========================================
    // 🔴 ACTION: REMOVE (例外許可から削除)
    // ==========================================
    if (action === 'remove') {
      if (!config.bypassUsers.includes(targetUser.id)) {
        return interaction.editReply({
          content: `❌ <@${targetUser.id}> は例外許可リストに登録されていません。`
        });
      }

      // 配列から削除
      config.bypassUsers = config.bypassUsers.filter(id => id !== targetUser.id);
      allSettings[guildId] = config;
      await client.saveSettings(allSettings);

      return interaction.editReply({
        content: `🔴 <@${targetUser.id}> を**例外許可リストから削除**しました。今後は通常通り重複IPチェックの対象になります。`
      });
    }
  }
};
