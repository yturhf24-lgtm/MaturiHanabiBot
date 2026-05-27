// index.js

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// Render Environment Variables からTOKEN取得
const TOKEN = process.env.TOKEN;

// TOKEN未設定防止
if (!TOKEN) {
  console.error('❌ TOKEN が設定されていません');
  process.exit(1);
}

// 保護対象ユーザー
const protectedUsers = [
  '1345621295303495711'
];

// 保護ロール
const protectedRoles = [
  '1406344310072414218',
  '1447596863678320641'
];

// 起動
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} 起動完了`);
});

// ロール監視
client.on('guildMemberUpdate', async (oldMember, newMember) => {

  try {

    // 指定ユーザー以外無視
    if (!protectedUsers.includes(newMember.id)) return;

    for (const roleId of protectedRoles) {

      const before = oldMember.roles.cache.has(roleId);
      const after = newMember.roles.cache.has(roleId);

      // ロール削除検知
      if (before && !after) {

        console.log(`⚠ ロール削除検知`);

        // 即復旧
        await newMember.roles.add(
          roleId,
          '保護ロール自動復旧'
        );

        console.log(`✅ ロール復旧完了`);

      }
    }

  } catch (err) {

    console.error('❌ エラー');

    console.error(err);

  }

});

// ログイン
client.login(TOKEN);
