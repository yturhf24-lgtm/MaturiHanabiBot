const { Client, GatewayIntentBits, Collection, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection();

// 許可する人
const ADMIN_ID = '1266013271518089258';
const ROLE_ID = process.env.ROLE_ID;

// コマンド読み込み
for (const f of fs.readdirSync('./commands').filter(f => f.endsWith('.js'))) {
  const cmd = require(`./commands/${f}`);
  client.commands.set(cmd.data.name, cmd);
}

// ✅ 権限チェック
function canUse(i) {
  if (i.user.id === ADMIN_ID) return true;
  if (i.member.permissions.has('Administrator')) return true;
  if (ROLE_ID && i.member.roles.cache.has(ROLE_ID)) return true;
  return false;
}

// ✅ チャンネルに権限なかったらEmbedで返す
async function checkPerm(i) {
  const ok = i.guild.members.me.permissionsIn(i.channel).has('SendMessages') &&
             i.guild.members.me.permissionsIn(i.channel).has('EmbedLinks');
  if (!ok) {
    const e = new EmbedBuilder().setColor('Red').setTitle('⚠️ 権限がないよ').setDescription('このチャンネルでは使えません');
    await i.reply({ embeds: [e], ephemeral: true });
    return false;
  }
  return true;
}

// コマンド受信
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;
  if (!canUse(i)) return i.reply({ content: '⛔ 使う権限がないよ', ephemeral: true });
  if (!await checkPerm(i)) return;
  
  const cmd = client.commands.get(i.commandName);
  if (!cmd) return;
  try { await cmd.execute(i); }
  catch (e) { await i.reply({ content: '❌ エラーだよ', ephemeral: true }); }
});

client.on('ready', () => console.log(`✅ ${client.user.tag} オンライン！`));
client.login(process.env.TOKEN);
