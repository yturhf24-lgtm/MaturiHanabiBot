const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

const { load, save } = require('./settings');

// ===============================
// TOKEN
// ===============================
const TOKEN = 'MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s';

// ===============================

let settings = load();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===============================
// 権限チェック
// ===============================

function hasPerm(i) {
  const owner = i.user.id === i.guild.ownerId;

  const admin = i.member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );

  const role = i.member.roles.cache.some(r =>
    settings.allowedRoleIds.includes(r.id)
  );

  return owner || admin || role;
}

// ===============================
// 起動
// ===============================

client.once('ready', async () => {
  console.log(client.user.tag + ' Ready');

  const commands = [

    new SlashCommandBuilder()
      .setName('監視')
      .setDescription('監視機能のON/OFF')
      .addBooleanOption(o =>
        o.setName('状態')
          .setDescription('ONかOFF')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('アラートチャンネル')
      .setDescription('通知チャンネル設定')
      .addChannelOption(o =>
        o.setName('チャンネル')
          .setDescription('送信先チャンネル')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('設定確認')
      .setDescription('現在の設定を確認'),

    new SlashCommandBuilder()
      .setName('サーバー情報')
      .setDescription('サーバー情報を表示')

  ].map(c => c.toJSON());

  await client.application.commands.set(commands);
});

// ===============================
// コマンド処理
// ===============================

client.on('interactionCreate', async i => {

  if (!i.isChatInputCommand()) return;

  settings = load();

  if (!hasPerm(i) && i.commandName !== '設定確認') {
    return i.reply({ content: '権限なし', ephemeral: true });
  }

  // 監視ON/OFF
  if (i.commandName === '監視') {
    settings.monitorEnabled = i.options.getBoolean('状態');
    save(settings);
    return i.reply('OK');
  }

  // 設定確認
  if (i.commandName === '設定確認') {
    return i.reply({
      content:
        `監視:${settings.monitorEnabled}\n` +
        `リンク:${settings.linkAlertEnabled}`,
      ephemeral: true
    });
  }

  // サーバー情報
  if (i.commandName === 'サーバー情報') {

    const g = i.guild;

    const bots = g.members.cache.filter(m => m.user.bot).size;
    const users = g.members.cache.filter(m => !m.user.bot).size;

    return i.reply({
      content:
        `合計:${g.memberCount}\nユーザー:${users}\nBOT:${bots}`
    });
  }

});

// ===============================
// リンク監視
// ===============================

client.on('messageCreate', m => {

  if (m.author.bot) return;
  if (!settings.monitorEnabled) return;

  if (!settings.alertChannelId) return;

  if (/(https?:\/\/)/.test(m.content)) {

    const ch = m.guild.channels.cache.get(settings.alertChannelId);
    if (!ch) return;

    ch.send(`リンク検知\n${m.author.tag}\n${m.content}`);
  }

});

// ===============================
// login
// ===============================

client.login(TOKEN);
