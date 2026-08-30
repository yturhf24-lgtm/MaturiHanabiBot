const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST, Routes } = require('discord.js');
const fs = require('fs');

// ✅ ポート起動
const http = require('http');
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord Bot is Running!\n');
}).listen(PORT, '0.0.0.0');
console.log(`✅ ポート ${PORT} を開きました`);

// ✅ 環境変数
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;

// ✅ クライアント
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages]
});
client.commands = new Collection();

// ✅ コマンド読み込み
const commands = [];
for (const file of fs.readdirSync('./commands').filter(f => f.endsWith('.js'))) {
  const cmd = require(`./commands/${file}`);
  client.commands.set(cmd.data.name, cmd);
  commands.push(cmd.data.toJSON());
}

// ✅ コマンド登録
async function deployCommands() {
  if (!TOKEN || !CLIENT_ID) return console.error('❌ TOKEN/CLIENT_ID 不足');
  try {
    console.log('🔄 コマンド登録中...');
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ コマンド登録完了');
  } catch (e) { console.error(e); }
}

// ✅ 権限チェック
async function canUse(i) {
  const ADMIN_ID = '1266010592851419146';
  return i.user.id === ADMIN_ID || i.guild.ownerId === i.user.id || i.member.permissions.has('Administrator');
}

// ✅ メイン処理
client.on('interactionCreate', async i => {

  // ============== ロール監視 メニュー/ボタン ==============
  if ((i.isRoleSelectMenu() || i.isChannelSelectMenu() || i.isButton()) && i.customId.startsWith('step')) {
    const parts = i.customId.replace(/-skip|-back/g, '').split('-');
    const step = parts[0] + '-' + parts[1];
    const cmd = client.commands.get('ロール監視');
    if (cmd?.handleSelect) return cmd.handleSelect(i, step);
  }
  // ==========================================================

  if (!i.isChatInputCommand() || !i.guild) return;
  if (!await canUse(i)) return i.reply({ content: '⛔ 実行権限がありません', flags: 64 });

  const cmd = client.commands.get(i.commandName);
  if (!cmd) return;
  try { await cmd.execute(i); }
  catch (e) { console.error(e); await i.reply({ content: '❌ エラーが発生しました', flags: 64 }); }
});

client.on('clientReady', async () => {
  console.log(`✅ ${client.user.tag} オンライン！`);
  await deployCommands();
});

client.login(TOKEN);
