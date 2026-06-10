const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN) {
  throw new Error('環境変数 DISCORD_TOKEN が設定されていません。');
}

if (!CLIENT_ID) {
  throw new Error('環境変数 CLIENT_ID が設定されていません。');
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(TOKEN);

rest
  .put(Routes.applicationCommands(CLIENT_ID), { body: commands })
  .then(() => {
    console.log(`${commands.length} 個のスラッシュコマンドを登録しました。`);
  })
  .catch((error) => {
    console.error('スラッシュコマンドの登録に失敗しました。', error);
    process.exit(1);
  });
