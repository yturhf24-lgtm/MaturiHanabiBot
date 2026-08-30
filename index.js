const { Client, GatewayIntentBits, Collection, PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
client.commands = new Collection();

// 許可設定
const ADMIN_ID = '1266013271518089258';

// コマンド読み込み
for (const f of fs.readdirSync('./commands').filter(f => f.endsWith('.js'))) {
  const cmd = require(`./commands/${f}`);
  client.commands.set(cmd.data.name, cmd);
}

// 実行権限チェック
function canUse(i) {
  if (i.user.id === ADMIN_ID) return true;
  if (i.member.permissions.has('Administrator')) return true;
  if (process.env.ROLE_ID && i.member.roles?.cache?.has(process.env.ROLE_ID)) return true;
  return false;
}

// チャンネル権限チェック → 無い場合Embedで返信
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
