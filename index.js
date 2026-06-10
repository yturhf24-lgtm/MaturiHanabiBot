const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  throw new Error('環境変数 DISCORD_TOKEN が設定されていません。');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildEmojisAndStickers,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if (!command.data || !command.execute) {
    console.warn(`${file} は data または execute が無いため読み込みませんでした。`);
    continue;
  }

  client.commands.set(command.data.name, command);
}

client.once('ready', () => {
  console.log(`${client.user.tag} でログインしました。`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);

    const errorMessage = {
      content: 'コマンド実行中にエラーが発生しました。',
      ephemeral: true,
    };

    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(errorMessage).catch(() => {});
    } else {
      await interaction.reply(errorMessage).catch(() => {});
    }
  }
});

client.login(TOKEN);
