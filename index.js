const { Client, GatewayIntentBits, Collection, EmbedBuilder, REST, Routes } = require('discord.js');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');

// ✅ Renderポート警告消し
const http = require('http');
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord Bot is Running!\n');
}).listen(PORT, '0.0.0.0');
console.log(`✅ ポート ${PORT} を開きました`);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection();

// ✅ 固定設定
const ADMIN_ID = '1266013271518089258';
const GITHUB_OWNER = 'yturhf24-lgtm';
const GITHUB_REPO = 'MaturiHanabiBot';
const FILE_PATH = 'roles.json';

// ✅ コマンド読み込み
const commands = [];
const commandsPath = './commands';
for (const f of fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'))) {
  const cmd = require(`${commandsPath}/${f}`);
  client.commands.set(cmd.data.name, cmd);
  commands.push(cmd.data.toJSON());
}

// ✅ グローバルコマンド自動登録
async function deployCommands() {
  const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
  const CLIENT_ID = process.env.CLIENT_ID;

  if (!TOKEN || !CLIENT_ID) {
    console.error('❌ 環境変数不足！');
    console.log(`TOKEN=${!!TOKEN} CLIENT_ID=${!!CLIENT_ID}`);
    return;
  }

  try {
    console.log('🔄 コマンドを登録中...');
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ コマンド登録 完了！ 全サーバーで利用可能');
  } catch (e) {
    console.error('❌ 登録エラー:', e.message);
  }
}

// ✅ GitHub読み書き
async function loadData() {
  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER, repo: GITHUB_REPO, path: FILE_PATH
    });
    return { content: JSON.parse(Buffer.from(data.content, 'base64').toString()), sha: data.sha };
  } catch { return { content: {}, sha: null }; }
}
async function saveData(newData) {
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
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

// ✅ 許可ロール取得
async function getAllowedRoles(gid) { const { content } = await loadData(); return content[gid] || []; }

// ✅ 🔑 権限チェック
async function canUse(i) {
  const userId = i.user.id;
  const commandName = i.commandName;
  const subCommand = i.options.getSubcommand(false);

  // ✅ 1. ADMIN_ID は 全サーバー・全コマンド 無条件許可
  if (userId === ADMIN_ID) return true;

  // ✅ 2. サーバー所有者は そのサーバー内で全コマンド許可
  if (i.guild.ownerId === userId) return true;

  // ✅ 3. 一覧系・確認系コマンド → 管理者 または 許可ロール保持者 を許可
  if (commandName === 'slowcheck' || subCommand === '一覧') {
    if (i.member.permissions.has('Administrator')) return true;
    const allowed = await getAllowedRoles(i.guildId);
    return i.member.roles.cache.some(r => allowed.includes(r.id));
  }

  // ❌ 許可/削除 は実行不可
  return false;
}

// ✅ チャンネル権限チェック
async function checkPerm(i) {
  const bot = i.guild.members.me;
  const ok = bot.permissionsIn(i.channel).has('SendMessages') &&
             bot.permissionsIn(i.channel).has('EmbedLinks');
  if (!ok) {
    await i.reply({ embeds: [new EmbedBuilder().setColor('Red').setTitle('⚠️ 権限なし').setDescription('このチャンネルでは使えません')], flags: 64 });
    return false;
  }
  return true;
}

// ✅ コマンド処理
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;
  if (!i.guild) return;

  if (!await canUse(i)) return i.reply({ content: '⛔ 実行権限がありません', flags: 64 });
  if (!await checkPerm(i)) return;

  const cmd = client.commands.get(i.commandName);
  if (!cmd) return;
  try { await cmd.execute(i); }
  catch (e) { console.error(e); await i.reply({ content: '❌ エラーが発生しました', flags: 64 }); }
});

// ✅ 起動完了時に自動登録
client.on('clientReady', async () => {
  console.log(`✅ ${client.user.tag} オンライン！`);
  await deployCommands();
});

// ✅ ログイン
client.login(process.env.DISCORD_TOKEN || process.env.TOKEN);
