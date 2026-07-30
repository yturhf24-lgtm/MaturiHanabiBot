const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
require('dotenv').config();

// --- 環境変数 ---
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// --- Discord クライアント設定 ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});
client.commands = new Collection();
const commandsArray = [];

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
    commandsArray.push(command.data.toJSON());
  }
}

// --- Bot起動 & コマンド登録処理 ---
const rest = new REST({ version: '10' }).setToken(TOKEN);

client.once('ready', async () => {
  console.log(`🤖 ログイン完了: ${client.user.tag}`);
  try {
    console.log('スラッシュコマンドを登録中...');
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commandsArray },
    );
    console.log('✅ スラッシュコマンドの登録が完了しました。');
  } catch (error) {
    console.error('スラッシュコマンド登録エラー:', error);
  }
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
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Discord Bot is Online!');
});

app.listen(PORT, () => {
  console.log(`🌐 ヘルスチェック用Webサーバーが Port ${PORT} で起動しました`);
});

// Botログイン
client.login(TOKEN);
