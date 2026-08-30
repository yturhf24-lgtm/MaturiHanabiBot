const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { REST, Routes } = require('discord.js');
const fs = require('fs');

// ✅ ポート起動（Render等対応）
const http = require('http');
const PORT = process.env.PORT || 10000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Discord Bot is Running!\n');
}).listen(PORT, '0.0.0.0');
console.log(`✅ ポート ${PORT} を開きました`);

// ✅ 環境変数
const TOKEN = process.env.DISCORD_TOKEN || process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;

// ✅ クライアント設定
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

client.commands = new Collection();

// ✅ コマンド読み込み
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commands.push(command.data.toJSON());
}

// ✅ コマンド自動登録
async function deployCommands() {
  if (!TOKEN || !CLIENT_ID) {
    console.error('❌ 環境変数 TOKEN または CLIENT_ID が設定されていません');
    return;
  }
  try {
    console.log('🔄 コマンドを登録中...');
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ コマンド登録 完了！');
  } catch (error) {
    console.error('❌ コマンド登録エラー:', error);
  }
}

// ✅ 権限チェック
async function canUse(interaction) {
  const ADMIN_ID = '1266010592851419146';
  if (interaction.user.id === ADMIN_ID) return true;
  if (interaction.guild.ownerId === interaction.user.id) return true;
  if (interaction.member.permissions.has('Administrator')) return true;
  return true;
}

// ✅ メイン処理
client.on('interactionCreate', async i => {
  if (!i.guild) return;

  // ============== ロール監視 メニュー/ボタン 処理 ==============
  if ((i.isRoleSelectMenu() || i.isChannelSelectMenu() || i.isButton()) && i.customId.startsWith('step')) {
    let step;
    if (i.customId.includes('-next') || i.customId.includes('-skip') || i.customId.includes('-back')) {
      step = i.customId.split('-')[0] + '-' + i.customId.split('-')[1];
    } else {
      step = i.customId.split('-')[0];
    }
    const command = client.commands.get('ロール監視');
    if (command?.handleSelect) return command.handleSelect(i, step);
  }
  // ==============================================================

  if (!i.isChatInputCommand()) return;
  if (!(await canUse(i))) {
    return i.reply({ content: '⛔ このコマンドを実行する権限がありません', flags: 64 });
  }

  const command = client.commands.get(i.commandName);
  if (!command) return;

  try {
    await command.execute(i);
  } catch (error) {
    console.error(error);
    if (!i.replied && !i.deferred) {
      await i.reply({ content: '❌ エラーが発生しました', flags: 64 });
    }
  }
});

// ✅ 起動完了時
client.on('ready', async () => {
  console.log(`✅ ${client.user.tag} が起動しました！`);
  await deployCommands();
});

// ✅ ログイン
client.login(TOKEN);
