// index.js

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// ===============================
// Discord Bot Token
// ===============================

const TOKEN = 'https://api.render.com/deploy/srv-d8bde4hakrks73djk320?key=JF-MZBufB7w';

// ===============================
// 保護対象ユーザー
// ===============================

const protectedUsers = [
  '1345621295303495711'
];

// ===============================
// 保護ロール
// ===============================

const protectedRoles = [
  '1406344310072414218',
  '1447596863678320641'
];

// ===============================

client.once('ready', () => {

  console.log(`✅ ${client.user.tag} 起動完了`);

});

// ロール削除監視
client.on('guildMemberUpdate', async (oldMember, newMember) => {

  try {

    // 指定ユーザー以外無視
    if (!protectedUsers.includes(newMember.id)) return;

    for (const roleId of protectedRoles) {

      const hadRole = oldMember.roles.cache.has(roleId);
      const hasRole = newMember.roles.cache.has(roleId);

      // ロール削除検知
      if (hadRole && !hasRole) {

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
