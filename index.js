const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
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

// ✅ クライアント作成
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

// ✅ コマンド読み込み
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = require(`./commands/${file}`);
  client.commands.set(cmd.data.name, cmd);
  commands.push(cmd.data.toJSON());
}

// ✅ コマンド自動登録
async function deployCommands() {
  if (!TOKEN || !CLIENT_ID) {
    console.error('❌ 環境変数 TOKEN または CLIENT_ID が不足しています');
    return;
  }
  try {
    console.log('🔄 コマンドを登録中...');
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ コマンド登録 完了！ 全サーバーで利用可能');
  } catch (e) {
    console.error('❌ コマンド登録エラー:', e);
  }
}

// ✅ 権限チェック
async function canUse(i) {
  const ADMIN_ID = '1266010592851419146';
  if (i.user.id === ADMIN_ID || i.guild.ownerId === i.user.id) return true;
  if (i.member.permissions.has('Administrator')) return true;
  return true;
}

// ✅ チャンネル権限チェック
async function checkPerm(i) {
  const bot = i.guild.members.me;
  return bot.permissionsIn(i.channel).has('SendMessages') &&
         bot.permissionsIn(i.channel).has('EmbedLinks');
}

// ✅ メイン処理
client.on('interactionCreate', async i => {

  // ============== ロール監視 メニュー/ボタン処理 ==============
  if ((i.isRoleSelectMenu() || i.isChannelSelectMenu() || i.isButton()) && i.customId.startsWith('step')) {
    let step = i.customId.includes('-skip') || i.customId.includes('-back')
      ? i.customId.replace(/-skip|-back/g, '').split('-')[0] + '-' + i.customId.split('-')[1]
      : i.customId.split('-')[0];
    const cmd = client.commands.get('ロール監視');
    if (cmd?.handleSelect) return cmd.handleSelect(i, step);
  }
  // ==============================================================

  // ✅ スラッシュコマンド処理
  if (!i.isChatInputCommand() || !i.guild) return;
  if (!await canUse(i)) return i.reply({ content: '⛔ 実行権限がありません', flags: 64 });
  if (!await checkPerm(i)) return;

  const cmd = client.commands.get(i.commandName);
  if (!cmd) return;
  try { await cmd.execute(i); }
  catch (e) { console.error(e); await i.reply({ content: '❌ エラーが発生しました', flags: 64 }); }
});

// ✅ 起動完了
client.on('clientReady', async () => {
  console.log(`✅ ${client.user.tag} オンライン！`);
  await deployCommands();
});

// ✅ ログイン
client.login(TOKEN);
