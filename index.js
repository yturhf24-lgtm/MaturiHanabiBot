const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;

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

// -------------------------------------------------------------
// 📁 data.json 管理システム（絶対パス＆強制保存・デバッグログ付き）
// -------------------------------------------------------------
const DATA_FILE = path.resolve(__dirname, 'data.json');
let localSettingsCache = {};

// 起動時にファイルがなければ作成、あれば読み込み
try {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
    console.log(`[Data Init] data.json が存在しなかったため新規作成しました: ${DATA_FILE}`);
  }
  
  const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
  localSettingsCache = JSON.parse(fileContent);
  console.log('[Data Load] データを正常に読み込みました:', localSettingsCache);
} catch (e) {
  console.error('[Data Error] 読み込み/初期化エラー:', e);
  localSettingsCache = {};
}

client.getSettings = () => localSettingsCache;

client.saveSettings = async (data) => {
  localSettingsCache = data;
  try {
    // 同期的に書き込み、確実にストレージへ反映させる
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[Data Saved] data.json への書き込みに成功しました (${DATA_FILE})`, data);
  } catch (e) {
    console.error('[Data Save Error] data.json への書き込みに失敗しました:', e);
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

client.once('clientReady', (c) => {
  console.log(`🟢 Bot ログイン完了: ${c.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`コマンド実行エラー [/${interaction.commandName}]:`, error);
    const errorMessage = { content: '⚠️ コマンドの実行中にエラーが発生しました。', flags: [MessageFlags.Ephemeral] };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(() => null);
    } else {
      await interaction.reply(errorMessage).catch(() => null);
    }
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

client.login(TOKEN);
