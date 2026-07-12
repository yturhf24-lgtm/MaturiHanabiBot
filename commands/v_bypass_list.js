const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_bypass_list')
    .setDescription('【管理・スタッフ用】裏アカウント検知対象および例外許可されているユーザーの一覧を表示します。')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),

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
      return interaction.editReply({ content: '❌ このコマンドを実行する権限がありません。' });
    }

    const verifiedIps = config.verifiedIps || {};
    const bypassUsers = config.bypassUsers || [];

    await interaction.guild.members.fetch().catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle('🛡️ 裏アカウント管理・例外リスト一覧')
      .setColor(0x3498db)
      .setTimestamp();

    // --- 🚨 パート1: 重複IP（裏垢）の自動計算 ---
    const ipUsers = {}; 
    for (const [ip, userId] of Object.entries(verifiedIps)) {
      if (!ipUsers[ip]) ipUsers[ip] = [];
      if (!ipUsers[ip].includes(userId)) ipUsers[ip].push(userId);
    }

    let detectText = '';
    let detectCount = 0;

    for (const [ip, userIds] of Object.entries(ipUsers)) {
      if (userIds.length > 1) {
        const originalUser = userIds[0];
        const altUsers = userIds.slice(1);

        for (const altUser of altUsers) {
          // 例外許可されている人はここには出さない
          if (bypassUsers.includes(altUser)) continue;

          detectCount++;
          detectText += `⚠️ **裏垢対象:** <@${altUser}> (\`${altUser}\`)\n┗ 👤 **登録済みの本垢:** <@${originalUser}> (\`${originalUser}\`)\n\n`;
        }
      }
    }

    if (detectCount === 0) {
      embed.addFields({ name: '🚨 現在検知されている裏アカウント', value: '現在、同一IPによるブロック対象プレイヤーはいません。' });
    } else {
      embed.addFields({ name: `🚨 現在検知されている裏アカウント (${detectCount}名)`, value: detectText });
    }

    // --- 🟢 パート2: 現在例外許可(Bypass)されているユーザー一覧 ---
    let bypassText = '';
    if (bypassUsers.length === 0) {
      bypassText = '現在、例外許可されているユーザーはいません。';
    } else {
      bypassUsers.forEach((userId, index) => {
        bypassText += `**${index + 1}.** 🟢 <@${userId}> \`(${userId})\`\n`;
      });
    }
    embed.addFields({ name: '🟢 例外許可（バイパス）中のユーザー', value: bypassText });

    return interaction.editReply({ embeds: [embed] });
  }
};
