const { Client, GatewayIntentBits, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection();

// ✅ 絶対に使えるユーザー
const ADMIN_ID = '1266013271518089258';

// ✅ 保存ファイルパス
const DATA_FILE = './roles.json';

// ✅ 保存ファイル読み込み（無ければ新規作成）
function loadData() {
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
// ✅ 保存
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
global.loadData = loadData;
global.saveData = saveData;

// ✅ 許可チェック
function getAllowedRoles(guildId) {
  const data = loadData();
  return data[guildId] || [];
}
function canUse(i) {
  if (i.user.id === ADMIN_ID) return true;
  if (i.member.permissions.has('Administrator')) return true;
  const allowed = getAllowedRoles(i.guildId);
  return i.member.roles.cache.some(r => allowed.includes(r.id));
}

// ✅ チャンネル権限チェック
async function checkPerm(i) {
  const bot = i.guild.members.me;
  const ok = bot.permissionsIn(i.channel).has('SendMessages') &&
             bot.permissionsIn(i.channel).has('EmbedLinks');
  if (!ok) {
    const emb = new EmbedBuilder().setColor('Red').setTitle('⚠️ 権限なし').setDescription('このチャンネルでは使えません');
    await i.reply({ embeds: [emb], ephemeral: true });
    return false;
  }
  return true;
}

// コマンド読み込み
for (const f of fs.readdirSync('./commands').filter(f => f.endsWith('.js'))) {
  const cmd = require(`./commands/${f}`);
  client.commands.set(cmd.data.name, cmd);
}

// コマンド処理
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;
  if (!canUse(i)) return i.reply({ content: '⛔ 実行権限がありません', ephemeral: true });
  if (!await checkPerm(i)) return;

  const cmd = client.commands.get(i.commandName);
  if (!cmd) return;
  try { await cmd.execute(i); }
  catch { await i.reply({ content: '❌ エラーが発生しました', ephemeral: true }); }
});

client.on('ready', () => console.log(`✅ ${client.user.tag} オンライン！`));
client.login(process.env.TOKEN);
