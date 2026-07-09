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

// --- GitHub API 経由のデータ管理設定 ---
const DATA_FILE = path.join(__dirname, 'data.json');

const GITHUB_OWNER = 'yturhf24-lgtm'; // リポジトリの所有者名
const GITHUB_REPO = 'MaturiHanabiBot';  // リポジトリ名
const FILE_PATH = 'data.json';

// メモリ上に最新データをキャッシュするための変数
let localSettingsCache = {};

// 🌟 GitHubからデータを引っ張ってくる関数
async function loadSettingsFromGitHub() {
  if (!process.env.GITHUB_TOKEN) {
    console.log('警告: GITHUB_TOKEN がないため、ローカルファイルを使用します。');
    if (fs.existsSync(DATA_FILE)) {
      localSettingsCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
    return;
  }

  try {
    console.log('GitHub APIから最新データを取得中...');
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'Render-Discord-Bot',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (response.ok) {
      const json = await response.json();
      // GitHubはファイルをBase64でエンコードして返すのでデコードする
      const content = Buffer.from(json.content, 'base64').toString('utf8');
      localSettingsCache = JSON.parse(content);
      fs.writeFileSync(DATA_FILE, JSON.stringify(localSettingsCache, null, 2));
      console.log('GitHubからのデータ同期に成功しました！');
    } else if (response.status === 404) {
      // 💡 無限ループ対策: 起動時はメモリを空にするだけで、GitHubへの勝手な書き込み（＝再デプロイ誘発）を防ぎます
      console.log('GitHub上に data.json がまだありません。初回コマンド実行時に自動生成されます。');
      localSettingsCache = {};
    } else {
      console.log(`GitHubの取得に失敗 (ステータス: ${response.status})。ローカルを使用します。`);
    }
  } catch (err) {
    console.error('GitHubデータの読み込みエラー:', err.message);
  }
}

client.getSettings = () => {
  return localSettingsCache;
};

// 🌟 データを書き換えたら、GitHub APIで直接上書き保存（コミット）する関数
client.saveSettings = async (data) => {
  localSettingsCache = data;
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  if (!process.env.GITHUB_TOKEN) return;

  try {
    console.log('GitHub APIを使って保存中...');
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    
    // 現在のファイルのSHA（上書きに必要なID）を取得する
    let sha = null;
    const getRes = await fetch(url, {
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'Render-Discord-Bot'
      }
    });
    if (getRes.ok) {
      const getJson = await getRes.json();
      sha = getJson.sha;
    }

    // 新しいデータをBase64に変換して送信
    const base64Content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'Render-Discord-Bot',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'chore: update data.json via API [skip ci]', // [skip ci]で意図しない挙動を防ぐ
        content: base64Content,
        sha: sha
      })
    });

    if (putRes.ok) {
      console.log('GitHub APIへのデータ保存が完全完了しました！');
    } else {
      console.error(`GitHubへの保存に失敗 (ステータス: ${putRes.status})`);
    }
  } catch (err) {
    console.error('GitHubへの保存中にエラーが発生しました:', err.message);
  }
};

// --- コマンド自動読み込み ---
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

// 起動時にデータを1回同期
client.once('ready', async () => {
  await loadSettingsFromGitHub();
  console.log(`Botがログインしました: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const errorEmbed = { description: 'コマンド実行時にエラーが発生しました。', color: 0xFF0000 };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
