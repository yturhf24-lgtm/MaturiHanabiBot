const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions
  ]
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  client.commands.set(command.data.name, command);
}

// ✅ 権限チェック
async function canUse(i) {
  const ADMIN_ID = '1266010592851419146'; // 必要に応じて管理者IDを入れる
  if (i.user.id === ADMIN_ID) return true;
  if (i.guild.ownerId === i.user.id) return true;

  const commandName = i.commandName;
  const subCommand = i.options.getSubcommand(false);

  // ✅ ロール監視・低速確認 等：許可ロール/管理者/所有者 OK
  const allowRoleCommands = ['slowcheck', 'ロール監視'];
  if (allowRoleCommands.includes(commandName) || subCommand === '一覧') {
    if (i.member.permissions.has('Administrator')) return true;
    const { default: config } = await import('./config.json', { assert: { type: 'json' } }).catch(() => ({ default: {} }));
    const allowedRoleIds = config.allowedRoleIds || [];
    return allowedRoleIds.some(rid => i.member.roles.cache.has(rid));
  }

  // ✅ その他：本人実行のみで事前チェック不要なものは個別処理で判定
  return true;
}

// ✅ チャンネル権限チェック
async function checkPerm(i) {
  return true;
}

// ✅ 起動時
client.once('ready', async () => {
  console.log(`✅ ${client.user.tag} オンライン！`);
  console.log(`✅ ポート 10000 を開きました`);

  const rest = new REST({ version: '10' }).setToken(token);
  const cmds = [];
  for (const [, cmd] of client.commands) cmds.push(cmd.data.toJSON());

  try {
    console.log('🔄 コマンドを登録中...');
    if (guildId) await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: cmds });
    else await rest.put(Routes.applicationCommands(clientId), { body: cmds });
    console.log('✅ コマンド登録 完了！ 全サーバーで利用可能');
  } catch (e) { console.error(e); }
});

// ✅ メイン：インタラクション処理
client.on('interactionCreate', async i => {
  // ─── 文字列選択メニュー（/ロール監視）───
  if (i.isStringSelectMenu() && i.customId.startsWith('main-')) {
    const cmd = client.commands.get('ロール監視');
    if (cmd?.handleMenu) return cmd.handleMenu(i, i.values[0]);
  }

  // ─── ロール選択メニュー（/ロール監視）───
  if (i.isRoleSelectMenu()) {
    const prefixes = ['check-','remove-','add-','savechk-','saverem-','saveadd-'];
    for (const p of prefixes) {
      if (i.customId.startsWith(p)) {
        const cmd = client.commands.get('ロール監視');
        if (cmd?.handleRole) return cmd.handleRole(i, p.replace('-',''));
      }
    }
  }

  // ─── スラッシュコマンド ───
  if (!i.isChatInputCommand() || !i.guild) return;

  if (!await canUse(i)) return i.reply({ content: '⛔ 実行権限がありません', flags: 64 });
  if (!await checkPerm(i)) return;

  const cmd = client.commands.get(i.commandName);
  if (!cmd) return;
  try { await cmd.execute(i); }
  catch (e) { console.error(e); await i.reply({ content: '❌ エラーが発生しました', flags: 64 }); }
});

client.login(token);
