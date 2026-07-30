const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();

// --- 環境変数 ---
const TOKEN = process.env.DISCORD_TOKEN;

// --- Discord クライアント設定 ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});
client.commands = new Collection();

// --- 設定保存用ヘルパー (data.json) ---
const SETTINGS_FILE = path.join(__dirname, 'data.json');

client.getSettings = () => {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({}, null, 2));
  }
  return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
};

client.saveSettings = async (data) => {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(data, null, 2));
};

// --- コマンドファイルの読み込み ---
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  }
}

// --- Bot起動イベント (警告解消済み) ---
client.once('clientReady', () => {
  console.log(`🤖 ログイン完了: ${client.user.tag}`);
});

// --- インタラクション (コマンド実行) イベント ---
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`エラー [${interaction.commandName}]:`, error);
    const content = '⚠️ コマンドの実行中にエラーが発生しました。';
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, ephemeral: true });
    } else {
      await interaction.reply({ content, ephemeral: true });
    }
  }
});

// --- Render Web Service用 ヘルスチェックサーバー ---
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Discord Bot is Online!');
});

app.listen(PORT, () => {
  console.log(`🌐 [Web Server] ポート ${PORT} で稼働中。`);
});

// Botログイン
client.login(TOKEN);
