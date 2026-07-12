const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_block')
    .setDescription('【管理・スタッフ用】裏アカウントのブロック管理コマンド')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false)
    // 🟢 サブコマンド1: 一覧表示 (旧 v_block_list)
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('このサーバーで裏アカウントとしてブロック（重複検知）されたプレイヤー一覧を表示します。')
    )
    // 🔴 サブコマンド2: ブロック解除 (旧 v_block remove)
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('指定したユーザーのブロックを解除（認証IPデータを削除）します。')
        .addUserOption(option =>
          option.setName('target')
            .setDescription('ブロックを解除するユーザーを選択')
            .setRequired(true)
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
        content: '❌ このコマンドを実行する権限がありません。（管理者権限、または設定された「許可ロール」が必要です）'
      });
    }

    const subcommand = interaction.options.getSubcommand();

    // ==========================================
    // 📑 処理1: LIST (一覧表示機能)
    // ==========================================
    if (subcommand === 'list') {
      const verifiedIps = config.verifiedIps || {};
      const bypassUsers = config.bypassUsers || {};

      // サーバー内のメンバー情報を取得
      await interaction.guild.members.fetch().catch(() => null);

      const embed = new EmbedBuilder()
        .setTitle('🚨 裏アカウント検出・ブロック対象一覧')
        .setColor(0xf04747)
        .setTimestamp();

      const ipUsers = {}; 
      for (const [ip, userId] of Object.entries(verifiedIps)) {
        if (!ipUsers[ip]) ipUsers[ip] = [];
        if (!ipUsers[ip].includes(userId)) {
          ipUsers[ip].push(userId);
        }
      }

      let listText = '';
      let count = 0;

      for (const [ip, userIds] of Object.entries(ipUsers)) {
        if (userIds.length > 1) {
          const originalUser = userIds[0];
          const altUsers = userIds.slice(1);

          for (const altUser of altUsers) {
            if (bypassUsers.includes(altUser)) continue;

            count++;
            listText += `⚠️ **裏垢対象:** <@${altUser}> (\`${altUser}\`)\n┗ 👤 **登録済みの本垢:** <@${originalUser}> (\`${originalUser}\`)\n\n`;
          }
        }
      }

      if (count === 0) {
        embed.setDescription('現在、このサーバーで同一IPによる重複（裏アカウント検知）の対象となっているプレイヤーはいません。全員正常に独立した環境で認証されています。');
        embed.setColor(0x2ecc71);
      } else {
        embed.setDescription(`現在、システム上で裏アカウント（重複IP）としてロック、または検知対象になっているプレイヤーが **${count}名** います。\n\n${listText}`);
      }

      return interaction.editReply({ embeds: [embed] });
    }

    // ==========================================
    // 🗑️ 処理2: REMOVE (ブロック解除機能)
    // ==========================================
    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('target');
      const verifiedIps = config.verifiedIps || {};

      // 指定されたユーザーのIDが、登録されているIPデータのどこかにあるか探す
      let foundIp = null;
      for (const [ip, userId] of Object.entries(verifiedIps)) {
        if (userId === targetUser.id) {
          foundIp = ip;
          break;
        }
      }

      if (!foundIp) {
        return interaction.editReply({ 
          content: `❌ <@${targetUser.id}> の認証IPデータが見つからないため、ブロック解除（データ削除）できませんでした。` 
        });
      }

      // 該当するIPデータを削除
      delete verifiedIps[foundIp];
      config.verifiedIps = verifiedIps;
      allSettings[guildId] = config;

      // GitHub/ローカルの data.json へ保存
      await client.saveSettings(allSettings);

      return interaction.editReply({ 
        content: `🗑️ <@${targetUser.id}> の認証データを削除し、ブロックを解除しました。（次回新しく認証が可能になります）` 
      });
    }
  }
};
