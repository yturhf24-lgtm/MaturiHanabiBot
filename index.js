const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Collection, MessageFlags, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // GitHubのアクセストークン
const REPO_OWNER = 'yturhf24-lgtm'; // あなたのGitHubユーザー名
const REPO_NAME = 'MaturiHanabiBot'; // リポジトリ名
const BRANCH = 'main'; // ブランチ名

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

client.commands = new Collection();

const DATA_FILE = path.resolve(__dirname, 'data.json');
let localSettingsCache = {};

// -------------------------------------------------------------
// 📁 GitHub連携型 data.json 管理システム（個別サーバー対応）
// -------------------------------------------------------------
async function loadDataFromGitHub() {
  try {
    if (GITHUB_TOKEN) {
      const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data.json?ref=${BRANCH}`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Discord-Bot'
        }
      });
      if (res.ok) {
        const fileData = await res.json();
        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        localSettingsCache = JSON.parse(content);
        fs.writeFileSync(DATA_FILE, content, 'utf8');
        console.log('[Data Load] GitHubから最新の data.json を読み込みました:', localSettingsCache);
        return;
      }
    }
  } catch (e) {
    console.error('[Data Load Warning] GitHubからの読み込みに失敗しました。ローカルファイルを使用します:', e);
  }

  // フォールバック：ローカルファイルまたは新規作成
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
    }
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    localSettingsCache = JSON.parse(fileContent);
    console.log('[Data Load] ローカルから data.json を読み込みました:', localSettingsCache);
  } catch (e) {
    console.error('[Data Error] 初期化エラー:', e);
    localSettingsCache = {};
  }
}

client.getSettings = () => localSettingsCache;

client.saveSettings = async (data) => {
  localSettingsCache = data;
  const jsonString = JSON.stringify(data, null, 2);
  
  // ローカルに保存
  try {
    fs.writeFileSync(DATA_FILE, jsonString, 'utf8');
  } catch (e) {
    console.error('[Local Save Error]:', e);
  }

  // GitHubへ自動コミット＆プッシュ
  if (!GITHUB_TOKEN) {
    console.warn('[GitHub Sync] GITHUB_TOKEN が設定されていないため、GitHubへの同期をスキップしました。');
    return;
  }

  try {
    const getRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data.json?ref=${BRANCH}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Discord-Bot'
      }
    });
    
    let sha = '';
    if (getRes.ok) {
      const fileInfo = await getRes.json();
      sha = fileInfo.sha;
    }

    const putRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Discord-Bot',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Auto-update data.json from Bot',
        content: Buffer.from(jsonString, 'utf8').toString('base64'),
        sha: sha,
        branch: BRANCH
      })
    });

    if (putRes.ok) {
      console.log('[GitHub Sync] data.json をGitHubへ正常に同期（コミット）しました！');
    } else {
      const errText = await putRes.text();
      console.error('[GitHub Sync Error]:', errText);
    }
  } catch (e) {
    console.error('[GitHub Sync Exception]:', e);
  }
};

// -------------------------------------------------------------
// コマンドファイルの自動読み込み
// -------------------------------------------------------------
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    }
  }
}

// -------------------------------------------------------------
// Bot起動時の処理 ＆ 埋め込み式再起動通知の送信
// -------------------------------------------------------------
client.once('clientReady', async (c) => {
  console.log(`🟢 Bot ログイン完了: ${c.user.tag}`);

  const settings = client.getSettings();
  
  for (const [guildId, guildSettings] of Object.entries(settings)) {
    const notifyConfig = guildSettings?.restartNotify;
    if (!notifyConfig || !notifyConfig.enabled || !notifyConfig.channelId) continue;

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) continue;

      const channel = await guild.channels.fetch(notifyConfig.channelId).catch(() => null);
      if (!channel) continue;

      let mentionText = '';
      if (notifyConfig.mention === '@everyone') mentionText = '@everyone';
      if (notifyConfig.mention === '@here') mentionText = '@here';

      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🔄 システム再起動・アップデート完了')
        .setDescription('Botのアップデートやシステムメンテナンスに伴う再起動・アップデートが行われました。正常に稼働を再開しています。')
        .setTimestamp();

      await channel.send({
        content: mentionText ? mentionText : null,
        embeds: [embed]
      }).catch(() => {});

    } catch (err) {
      console.error(`サーバー ${guildId} への再起動通知送信エラー:`, err);
    }
  }
});

// スラッシュコマンドの実行処理（埋め込みエラー対応）
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`コマンド実行エラー [/${interaction.commandName}]:`, error);
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ 実行エラー')
      .setDescription('コマンドの実行中にエラーが発生しました。');

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }
  }
});

// -------------------------------------------------------------
// イベント監視（荒らし対策各種）
// -------------------------------------------------------------
client.on('guildMemberAdd', async (member) => {
  const avatarCommand = client.commands.get('anti-default-avatar');
  if (avatarCommand && avatarCommand.handleMemberAdd) {
    await avatarCommand.handleMemberAdd(member, client);
  }

  const newAccCommand = client.commands.get('anti-new-account');
  if (newAccCommand && newAccCommand.handleMemberAdd) {
    await newAccCommand.handleMemberAdd(member, client);
  }
});

client.on('messageCreate', async (message) => {
  const antiInviteCmd = client.commands.get('anti-invite');
  if (antiInviteCmd && antiInviteCmd.handleMessage) {
    await antiInviteCmd.handleMessage(message, client);
  }

  const antiSpamCmd = client.commands.get('anti-spam-message');
  if (antiSpamCmd && antiSpamCmd.handleMessage) {
    await antiSpamCmd.handleMessage(message, client);
  }
});

// Render Web Service用サーバー
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Discord Bot is Online!');
});

app.listen(PORT, () => {
  console.log(`🌐 [Web Server] ポート ${PORT} で稼働中。`);
});

// 起動時にデータをロードしてからログイン
loadDataFromGitHub().then(() => {
  client.login(TOKEN);
});
