const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- Render用 Webサーバー処理 ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Status: Online'));
app.listen(PORT, () => console.log(`HTTP Web Server listening on port ${PORT}`));

// --- Discord Bot 本体 ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const DATA_FILE = path.join(__dirname, 'data.json');
const GITHUB_OWNER = 'yturhf24-lgtm';
const GITHUB_REPO = 'MaturiHanabiBot';
const FILE_PATH = 'data.json';

let localSettingsCache = {};

async function loadSettingsFromGitHub() {
  if (!process.env.GITHUB_TOKEN) {
    if (fs.existsSync(DATA_FILE)) localSettingsCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return;
  }
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Discord-Bot', 'Accept': 'application/vnd.github.v3+json' }
    });
    if (response.ok) {
      const json = await response.json();
      const content = Buffer.from(json.content, 'base64').toString('utf8');
      localSettingsCache = JSON.parse(content);
      fs.writeFileSync(DATA_FILE, JSON.stringify(localSettingsCache, null, 2));
    } else if (response.status === 404) {
      localSettingsCache = {};
    }
  } catch (err) { console.error(err.message); }
}

client.getSettings = () => localSettingsCache;

client.saveSettings = async (data) => {
  localSettingsCache = data;
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  if (!process.env.GITHUB_TOKEN) return;
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    let sha = null;
    const getRes = await fetch(url, { headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Discord-Bot' } });
    if (getRes.ok) { const getJson = await getRes.json(); sha = getJson.sha; }
    const base64Content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Discord-Bot', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'chore: update data.json via API [skip ci]', content: base64Content, sha: sha })
    });
  } catch (err) { console.error(err.message); }
};

// コマンド読み込み
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) client.commands.set(command.data.name, command);
}

// 🚀 起動完了イベント
client.once('clientReady', async () => {
  await loadSettingsFromGitHub();
  console.log(`Botがログインしました: ${client.user.tag}`);
});

// インタラクション受信（スラッシュコマンドのみに厳選）
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try { 
    await command.execute(interaction); 
  } catch (error) { 
    console.error(error); 
  }
});

// 💡 通知は一切行わず、プロセス終了シグナルを受け取ったら即安全にシャットダウンします
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

client.login(process.env.DISCORD_TOKEN);
