const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const express = require('express');
const { execSync } = require('node:child_process'); // 💡 Git操作用のモジュール

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

// --- GitHub自動同期対応データ保存ヘルパー ---
const DATA_FILE = path.join(__dirname, 'data.json');

// 起動時に最新のデータをGitHubから強制プル(同期)する
try {
  console.log('GitHubから最新のデータを同期中...');
  execSync('git config --global user.name "RenderBot"');
  execSync('git config --global user.email "bot@render.com"');
  execSync('git pull origin main'); 
  console.log('データの同期が完了しました。');
} catch (e) {
  console.log('初期同期スキップ、またはエラー:', e.message);
}

client.getSettings = () => {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}));
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { return {}; }
};

// 💡 データを書き込んだら、即座にGitHubへ自動送信する関数
client.saveSettings = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  
  // GitHubへの自動保存処理 (Render環境のトークンを使用)
  if (process.env.GITHUB_TOKEN) {
    try {
      console.log('GitHubへ設定を自動保存中...');
      // 認証情報付きのURLを再設定
      const repoUrl = execSync('git remote get-url origin').toString().trim();
      if (!repoUrl.includes('x-access-token')) {
        const authenticatedUrl = repoUrl.replace('https://github.com/', `https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/`);
        execSync(`git remote set-url origin ${authenticatedUrl}`);
      }
      
      // コミットしてプッシュ
      execSync('git add data.json');
      execSync('git commit -m "chore: update data.json [skip ci]" || true'); // 変更がない場合はスルー
      execSync('git push origin main');
      console.log('GitHubへの保存が成功しました！');
    } catch (gitError) {
      console.error('GitHub自動保存エラー:', gitError.message);
    }
  } else {
    console.log('警告: GITHUB_TOKEN が環境変数に設定されていないため、データは次回再起動時にリセットされます。');
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

client.once('clientReady', () => {
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
