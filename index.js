const { Client, GatewayIntentBits, Collection, EmbedBuilder, REST, Routes } = require('discord.js');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');

// ✅ Renderポート警告消し用
const http = require('http');
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord Bot is Running!\n');
}).listen(PORT, '0.0.0.0');
console.log(`✅ ポート ${PORT} を開きました`);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection();

// ✅ 設定
const ADMIN_ID = '1266013271518089258';
const GITHUB_OWNER = 'yturhf24-lgtm';
const GITHUB_REPO = 'MaturiHanabiBot';
const FILE_PATH = 'roles.json';
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ✅ 環境変数チェック（無いときはエラー表示）
if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ 環境変数が不足しています！ TOKEN, CLIENT_ID, GUILD_ID を確認してください');
  process.exit(1);
}

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// ✅ コマンド一覧を読み込み
const commands = [];
const commandsPath = './commands';
for (const f of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(`${commandsPath}/${f}`);
  client.commands.set(cmd.data.name, cmd);
  commands.push(cmd.data.toJSON());
}

// ✅ 自動コマンド登録
async function deployCommands() {
  try {
    console.log('🔄 コマンドを自動登録中...');
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ コマンド自動登録 完了！');
  } catch (e) {
    console.error('❌ コマンド登録エラー:', e.message);
  }
}

// ✅ GitHub読み書き
async function loadData() {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path: FILE_PATH
    });
    return { content: JSON.parse(Buffer.from(data.content, 'base64').toString()), sha: data.sha };
  } catch { return { content: {}, sha: null }; }
}
async function saveData(newData) {
  const { sha } = await loadData();
  await octokit.rest.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER, repo: GITHUB_REPO, path: FILE_PATH,
    message: `💾 更新 - ${new Date().toLocaleString('ja-JP')}`,
    content: Buffer.from(JSON.stringify(newData, null, 2)).toString('base64'), sha
  });
  console.log('✅ GitHubに保存');
}
global.loadData = loadData;
global.saveData = saveData;

// ✅ 権限チェック
async function getAllowedRoles(gid) { const { content } = await loadData(); return content[gid] || []; }
async function canUse(i) {
  if (i.user.id === ADMIN_ID) return true;
  if (i.member.permissions.has('Administrator')) return true;
  return i.member.roles.cache.some(r => getAllowedRoles(i.guildId).includes(r.id));
}
async function checkPerm(i) {
  const bot = i.guild.members.me;
  const ok = bot.permissionsIn(i.channel).has('SendMessages') &&
             bot.permissionsIn(i.channel).has('EmbedLinks');
  if (!ok) {
    await i.reply({ embeds: [new EmbedBuilder().setColor('Red').setTitle('⚠️ 権限なし').setDescription('このチャンネルでは使えません')], ephemeral: true });
    return false;
  }
  return true;
}

// ✅ コマンド処理
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;
  if (!await canUse(i)) return i.reply({ content: '⛔ 実行権限がありません', ephemeral: true });
  if (!await checkPerm(i)) return;
  const cmd = client.commands.get(i.commandName);
  if (!cmd) return;
  try { await cmd.execute(i); }
  catch (e) { console.error(e); await i.reply({ content: '❌ エラー', ephemeral: true }); }
});

// ✅ Bot起動時に自動登録（順番を正しく！）
client.on('clientReady', async () => {
  console.log(`✅ ${client.user.tag} オンライン！`);
  await deployCommands(); // 🔑 TOKENを確実に読んだ後に実行
});

client.login(TOKEN);
