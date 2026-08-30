const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const { Octokit } = require('@octokit/rest');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection();

// ✅ 設定
const ADMIN_ID = '1266013271518089258';
const GITHUB_OWNER = 'yturhf24-lgtm';
const GITHUB_REPO = '-bot';
const FILE_PATH = 'roles.json';

// ✅ Renderの環境変数から読み込み
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// ✅ GitHubから読み込み
async function loadData() {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: FILE_PATH
    });
    const content = Buffer.from(data.content, 'base64').toString();
    return { content: JSON.parse(content), sha: data.sha };
  } catch {
    return { content: {}, sha: null };
  }
}

// ✅ GitHubに直接書き込み保存
async function saveData(newData) {
  const { sha } = await loadData();
  const content = Buffer.from(JSON.stringify(newData, null, 2)).toString('base64');
  
  await octokit.rest.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: FILE_PATH,
    message: `💾 ロール更新 - ${new Date().toLocaleString('ja-JP')}`,
    content,
    sha
  });
  console.log('✅ GitHubに保存しました');
}

global.loadData = loadData;
global.saveData = saveData;

// ✅ 許可ロール取得
async function getAllowedRoles(guildId) {
  const { content } = await loadData();
  return content[guildId] || [];
}

// ✅ 実行権限チェック
async function canUse(i) {
  if (i.user.id === ADMIN_ID) return true;
  if (i.member.permissions.has('Administrator')) return true;
  const allowed = await getAllowedRoles(i.guildId);
  return i.member.roles.cache.some(r => allowed.includes(r.id));
}

// ✅ チャンネル権限チェック → 無い場合Embedでお知らせ
async function checkPerm(i) {
  const bot = i.guild.members.me;
  const ok = bot.permissionsIn(i.channel).has('SendMessages') &&
             bot.permissionsIn(i.channel).has('EmbedLinks');
  if (!ok) {
    const emb = new EmbedBuilder().setColor('Red').setTitle('⚠️ 権限なし').setDescription('このチャンネルでは使えません');
    await i.reply({ embeds: [emb], ephemeral: true });
    return false;
  }
  return true;
}

// ✅ コマンド読み込み
for (const f of fs.readdirSync('./commands').filter(f => f.endsWith('.js'))) {
  const cmd = require(`./commands/${f}`);
  client.commands.set(cmd.data.name, cmd);
}

// ✅ コマンド処理
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;
  if (!await canUse(i)) return i.reply({ content: '⛔ 実行権限がありません', ephemeral: true });
  if (!await checkPerm(i)) return;

  const cmd = client.commands.get(i.commandName);
  if (!cmd) return;
  try { await cmd.execute(i); }
  catch (e) { console.error(e); await i.reply({ content: '❌ エラーが発生しました', ephemeral: true }); }
});

// こちらに置き換え
client.on('clientReady', () => console.log(`✅ ${client.user.tag} オンライン！`));
client.login(process.env.TOKEN);
