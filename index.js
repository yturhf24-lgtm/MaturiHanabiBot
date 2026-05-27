const {
  Client,
  GatewayIntentBits
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const TOKEN = process.env.TOKEN;

const protectedUsers = [
  '1345621295303495711'
];

const protectedRoles = [
  '1406344310072414218',
  '1447596863678320641'
];

client.once('ready', () => {
  console.log(`✅ ${client.user.tag} 起動完了`);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {

  try {

    if (!protectedUsers.includes(newMember.id)) return;

    for (const roleId of protectedRoles) {

      const before = oldMember.roles.cache.has(roleId);
      const after = newMember.roles.cache.has(roleId);

      if (before && !after) {

        console.log(`⚠ ロール削除検知`);

        await newMember.roles.add(
          roleId,
          '保護ロール自動復旧'
        );

        console.log(`✅ ロール復旧完了`);
      }
    }

  } catch (err) {

    console.error(err);

  }

});

client.login(TOKEN);
