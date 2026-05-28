const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
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
      .setDescription('全チャンネル監視ON/OFF')
      .addBooleanOption(o =>
        o.setName('状態').setDescription('ON/OFF').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('アラートチャンネル')
      .setDescription('通知チャンネル設定')
      .addChannelOption(o =>
        o.setName('チャンネル')
          .setDescription('指定')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('リンクアラート')
      .setDescription('リンク監視ON/OFF')
      .addBooleanOption(o =>
        o.setName('状態').setDescription('ON/OFF').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('新規アカウントアラート')
      .setDescription('10日以内アカウント検知')
      .addBooleanOption(o =>
        o.setName('状態').setDescription('ON/OFF').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('設定確認')
      .setDescription('ON/OFF確認'),

    new SlashCommandBuilder()
      .setName('サーバー情報')
      .setDescription('サーバー情報表示'),

    new SlashCommandBuilder()
      .setName('パネル')
      .setDescription('説明＋ボタン表示')

  ].map(c => c.toJSON());

  await client.application.commands.set(cmds);
});

// ===============================
// 権限
// ===============================

client.on('interactionCreate', async i => {

  if (!i.isChatInputCommand()) return;

  settings = load();

  if (!hasPerm(i) && i.commandName !== '設定確認' && i.commandName !== 'サーバー情報') {
    return i.reply({ content: '権限なし', ephemeral: true });
  }

  // =========================
  // 監視
  // =========================
  if (i.commandName === '監視') {
    settings.monitorEnabled = i.options.getBoolean('状態');
    save(settings);
    return i.reply({ content: 'OK', ephemeral: true });
  }

  // =========================
  // リンク
  // =========================
  if (i.commandName === 'リンクアラート') {
    settings.linkAlertEnabled = i.options.getBoolean('状態');
    save(settings);
    return i.reply({ content: 'OK', ephemeral: true });
  }

  // =========================
  // アカウント
  // =========================
  if (i.commandName === '新規アカウントアラート') {
    settings.newAccountAlertEnabled = i.options.getBoolean('状態');
    save(settings);
    return i.reply({ content: 'OK', ephemeral: true });
  }

  // =========================
  // アラートチャンネル
  // =========================
  if (i.commandName === 'アラートチャンネル') {
    settings.alertChannelId = i.options.getChannel('チャンネル').id;
    save(settings);
    return i.reply({ content: 'OK', ephemeral: true });
  }

  // =========================
  // 設定確認
  // =========================
  if (i.commandName === '設定確認') {
    return i.reply({
      content:
        `監視:${settings.monitorEnabled}\n` +
        `リンク:${settings.linkAlertEnabled}\n` +
        `新規:${settings.newAccountAlertEnabled}`,
      ephemeral: true
    });
  }

  // =========================
  // サーバー情報
  // =========================
  if (i.commandName === 'サーバー情報') {

    const g = i.guild;

    const bots = g.members.cache.filter(m => m.user.bot).size;
    const users = g.members.cache.filter(m => !m.user.bot).size;

    return i.reply({
      content:
`サーバー名:${g.name}
合計:${g.memberCount}
ユーザー:${users}
BOT:${bots}`,
      ephemeral: true
    });
  }

  // =========================
  // パネル（説明＋ボタン）
  // =========================
  if (i.commandName === 'パネル') {

    const embed = new EmbedBuilder()
      .setTitle('パネル')
      .setDescription(settings.panelText);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('panel_btn')
        .setLabel(settings.panelButton)
        .setStyle(ButtonStyle.Primary)
    );

    return i.reply({
      embeds: [embed],
      components: [row],
      ephemeral: true
    });
  }

});

// ===============================
// リンク監視
// ===============================

client.on('messageCreate', m => {

  if (m.author.bot) return;
  if (!settings.monitorEnabled) return;
  if (!settings.linkAlertEnabled) return;

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
