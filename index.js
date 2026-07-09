const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- Render用 Webサーバー処理 (24時間稼働・常時オンライン化用) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot Status: Online');
});

app.listen(PORT, () => {
  console.log(`HTTP Web Server listening on port ${PORT}`);
});

// --- Discord Bot 本体処理 ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// --- JSONファイルベースの簡易データ保存ヘルパー ---
const DATA_FILE = path.join(__dirname, 'data.json');

client.getSettings = () => {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
};

client.saveSettings = (data) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// --- コマンドフォルダからの動的読み込み (個別運用ハンドラー) ---
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

client.once('ready', () => {
  console.log(`Botがログインしました: ${client.user.tag}`);
});

// スラッシュコマンド受信時のイベントハンドラー
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const errorEmbed = {
      description: 'コマンド実行時にエラーが発生しました。',
      color: 0xFF0000
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
