const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_block')
    .setDescription('【管理者専用】裏アカウントブロックの確認・削除・追加を管理します')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // サブコマンド1: 一覧表示
    .addSubcommand(subcmd =>
      subcmd
        .setName('list')
        .setDescription('このサーバーでブロックされている裏アカウントの一覧を表示します')
    )
    // サブコマンド2: ブロック解除（個別許可・削除）
    .addSubcommand(subcmd =>
      subcmd
        .setName('remove')
        .setDescription('指定したユーザーのブロックを解除（一覧から削除）します')
        .addStringOption(opt => opt.setName('userid').setDescription('解除したいユーザーのDiscord ID').setRequired(true))
    )
    // サブコマンド3: 手動ブロック追加
    .addSubcommand(subcmd =>
      subcmd
        .setName('add')
        .setDescription('指定したユーザーを手動でブロックリストに追加します')
        .addStringOption(opt => opt.setName('userid').setDescription('ブロックしたい裏垢のDiscord ID').setRequired(true))
        .addStringOption(opt => opt.setName('main_userid').setDescription('紐付ける本垢のDiscord ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    
    // index.jsに実装されている共通のデータ読み込み/保存関数を使用
    const allSettings = interaction.client.getSettings();
    
    // サーバー個別枠の初期化
    if (!allSettings[guildId]) allSettings[guildId] = {};
    if (!allSettings[guildId].blockedUsers) allSettings[guildId].blockedUsers = {};
    
    const config = allSettings[guildId];

    // ----------------------------------------
    // 📋 【LIST】一覧表示の処理
    // ----------------------------------------
    if (sub === 'list') {
      const list = config.blockedUsers;
      const keys = Object.keys(list);

      if (keys.length === 0) {
        return interaction.reply({ content: '✅ 現在、このサーバーでブロックされている裏アカウントはありません。', flags: [MessageFlags.Ephemeral] });
      }

      const embed = new EmbedBuilder()
        .setTitle('🚫 このサーバーの裏アカウントブロック一覧')
        .setColor(0xf04747)
        .setTimestamp();

      // 最大25件まで表示（Discordの仕様制限対策）
      const displayKeys = keys.slice(0, 25);
      let desc = 'ユーザーIDをクリックすると詳細が確認できます。\n\n';
      
      for (const bUserId of displayKeys) {
        const mainUserId = list[bUserId];
        desc += `❌ **裏垢:** <@${bUserId}> ➔ 👤 **本垢:** <@${mainUserId}>\n(裏垢ID: \`${bUserId}\`)\n\n`;
      }

      if (keys.length > 25) {
        desc += `*※件数が多いため、最新の25件のみ表示しています。*`;
      }

      embed.setDescription(desc);
      return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    // ----------------------------------------
    // 🔓 【REMOVE】ブロック解除（許可・削除）の処理
    // ----------------------------------------
    if (sub === 'remove') {
      const targetId = interaction.options.getString('userid').trim();

      if (!config.blockedUsers[targetId]) {
        return interaction.reply({ content: `❌ 指定されたユーザーID (\`${targetId}\`) は、このサーバーのブロックリストに登録されていません。`, flags: [MessageFlags.Ephemeral] });
      }

      // 該当ユーザーをサーバー固有のリストから削除
      delete config.blockedUsers[targetId];
      
      // GitHub / ローカルデータへ保存
      await interaction.client.saveSettings(allSettings);

      return interaction.reply({ content: `✅ <@${targetId}> (\`${targetId}\`) のブロックを解除しました。これで該当サーバーへの再認証が可能になります。`, flags: [MessageFlags.Ephemeral] });
    }

    // ----------------------------------------
    // 🔒 【ADD】手動ブロック追加の処理
    // ----------------------------------------
    if (sub === 'add') {
      const bUserId = interaction.options.getString('userid').trim();
      const mainUserId = interaction.options.getString('main_userid').trim();

      if (bUserId === mainUserId) {
        return interaction.reply({ content: '❌ 裏垢と本垢に同じIDを指定することはできません。', flags: [MessageFlags.Ephemeral] });
      }

      // サーバー固有のリストへ書き込み
      config.blockedUsers[bUserId] = mainUserId;
      
      // GitHub / ローカルデータへ保存
      await interaction.client.saveSettings(allSettings);

      return interaction.reply({ content: `🔒 裏垢: <@${bUserId}> と 本垢: <@${mainUserId}> を紐付けてブロックリストに登録しました。`, flags: [MessageFlags.Ephemeral] });
    }
  }
};
