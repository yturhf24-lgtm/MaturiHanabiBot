const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;

// 対象ユーザー
const protectedUsers = new Set([
  '1345621295303495711'
]);

// 保護ロール
const protectedRoles = [
  '1406344310072414218',
  '1447596863678320641'
];

client.once('ready', () => {
  console.log(`✅ 起動完了: ${client.user.tag}`);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {
    if (!protectedUsers.has(newMember.id)) return;

    // ロール差分確認（安全版）
    const removedRoles = oldMember.roles.cache.filter(
      role => !newMember.roles.cache.has(role.id)
    );

    for (const roleId of protectedRoles) {

      // 削除された場合だけ復旧
      if (removedRoles.has(roleId)) {

        const role = newMember.guild.roles.cache.get(roleId);
        if (!role) continue;

        // 重要：Botのロール順位チェック
        const botMember = newMember.guild.members.me;
        if (role.position >= botMember.roles.highest.position) {
          console.log(`⚠ ロール順位が低くて付与不可: ${roleId}`);
          continue;
        }

        await newMember.roles.add(roleId, 'auto restore');

        console.log(`✅ 復旧成功: ${roleId}`);
      }
    }

  } catch (err) {
    console.error('❌ エラー:', err);
  }
});

client.login(TOKEN);
