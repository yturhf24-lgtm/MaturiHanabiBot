const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===============================
// TOKEN（ここは必ず正しいもの）
// ===============================

const TOKEN = 'MTM1MzM5MzE5NDQxNDYzNzE5OA.GXgtZG.SDW89nKd9GSYjsBh7BJgMDPy_jTbTG-n_pM56Y';

// ===============================
// 対象ユーザー
// ===============================

const protectedUsers = new Set([
  '1345621295303495711'
]);

// ===============================
// 保護ロール
// ===============================

const protectedRoles = [
  '1406344310072414218',
  '1447596863678320641'
];

// ===============================

client.once('ready', () => {
  console.log(`✅ 起動完了: ${client.user.tag}`);
});

// ===============================
// ロール監視（安定版）
// ===============================

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  try {

    if (!protectedUsers.has(newMember.id)) return;

    const botMember = newMember.guild.members.me;

    for (const roleId of protectedRoles) {

      const hadRole = oldMember.roles.cache.has(roleId);
      const hasRole = newMember.roles.cache.has(roleId);

      if (!hadRole || hasRole) continue;

      const role = newMember.guild.roles.cache.get(roleId);
      if (!role) continue;

      // ★重要：ロール順位チェック
      if (role.position >= botMember.roles.highest.position) {
        console.log(`⚠ ロール順位が低くて付与不可: ${roleId}`);
        continue;
      }

      await newMember.roles.add(roleId, 'auto restore');

      console.log(`✅ 復旧成功: ${roleId}`);
    }

  } catch (err) {
    console.error('❌ エラー:', err);
  }
});

client.login(TOKEN);
