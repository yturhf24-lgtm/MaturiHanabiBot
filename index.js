const Discord = require('discord.js');

const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers
  ]
});

// 新しいTOKEN
const TOKEN = 'MTM1MzM5MzE5NDQxNDYzNzE5OA.GXgtZG.SDW89nKd9GSYjsBh7BJgMDPy_jTbTG-n_pM56Y';

// 保護対象
const protectedUsers = [
  '1345621295303495711'
];

// 保護ロール
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

      const hadRole = oldMember.roles.cache.has(roleId);
      const hasRole = newMember.roles.cache.has(roleId);

      if (hadRole && !hasRole) {

        console.log(`⚠ ロール削除検知`);

        await newMember.roles.add(roleId);

        console.log(`✅ ロール復旧完了`);
      }
    }

  } catch (err) {

    console.error(err);

  }

});

client.login(TOKEN);
