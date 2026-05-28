const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField
} = require('discord.js');

const { load, save } = require('./settings');

const TOKEN = 'MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s';

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
// 権限
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

  const cmds = [

    new SlashCommandBuilder()
      .setName('監視')
      .setDescription('ON/OFF')
      .addBooleanOption(o =>
        o.setName('状態').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('アラートチャンネル')
      .setDescription('設定')
      .addChannelOption(o =>
        o.setName('チャンネル')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('設定確認')
      .setDescription('確認'),

    new SlashCommandBuilder()
      .setName('サーバー情報')
      .setDescription('情報'),

    new SlashCommandBuilder()
      .setName('パネル')
      .setDescription('表示')

  ].map(c => c.toJSON());

  await client.application.commands.set(cmds);
});

// ===============================
// コマンド
// ===============================

client.on('interactionCreate', async i => {

  if (!i.isChatInputCommand()) return;

  settings = load();

  if (!hasPerm(i) && i.commandName !== '設定確認') {
    return i.reply({ content: '権限なし' });
  }

  if (i.commandName === '監視') {
    settings.monitorEnabled = i.options.getBoolean('状態');
    save(settings);
    return i.reply({ content: 'OK' });
  }

  if (i.commandName === '設定確認') {
    return i.reply({
      content:
        `監視:${settings.monitorEnabled}\n` +
        `リンク:${settings.linkAlertEnabled}`,
      ephemeral: true
    });
  }

  if (i.commandName === 'サーバー情報') {

    const g = i.guild;

    const bots = g.members.cache.filter(m => m.user.bot).size;
    const users = g.members.cache.filter(m => !m.user.bot).size;

    return i.reply({
      content:
        `合計:${g.memberCount}\nユーザー:${users}\nBOT:${bots}`
    });
  }

  if (i.commandName === 'パネル') {

    const embed = new EmbedBuilder()
      .setTitle('パネル')
      .setDescription(settings.panelDescription);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel')
        .setLabel(settings.panelButtonLabel)
        .setStyle(ButtonStyle.Success)
    );

    return i.reply({
      embeds: [embed],
      components: [row]
    });
  }

});

// ===============================
// メッセージ監視
// ===============================

client.on('messageCreate', m => {

  if (m.author.bot) return;
  if (!settings.monitorEnabled) return;

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
