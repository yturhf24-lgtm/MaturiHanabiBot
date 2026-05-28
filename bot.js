const fs = require('fs');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionsBitField
} = require('discord.js');

const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.log('TOKENなし');
  process.exit(1);
}

const SETTINGS_FILE = './settings.json';

const defaultSettings = {
  monitorEnabled: true,
  linkAlertEnabled: true,
  newAccountAlertEnabled: true,
  alertChannelId: null,
  allowedRoleIds: [],
  panelDescription: '説明を入力してください',
  panelButtonLabel: '開く'
};

let settings = defaultSettings;

// ===============================
// load/save
// ===============================

function loadSettings() {
  if (!fs.existsSync(SETTINGS_FILE)) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
  }
  settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
}

function saveSettings() {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

loadSettings();

// ===============================
// client
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===============================
// permission
// ===============================

function hasPerm(interaction) {
  const isOwner = interaction.user.id === interaction.guild.ownerId;

  const isAdmin = interaction.member.permissions.has(
    PermissionsBitField.Flags.Administrator
  );

  const roleOk = interaction.member.roles.cache.some(r =>
    settings.allowedRoleIds.includes(r.id)
  );

  return isOwner || isAdmin || roleOk;
}

// ===============================
// ready
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
      .setName('リンクアラート')
      .setDescription('ON/OFF')
      .addBooleanOption(o =>
        o.setName('状態').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('新規アカウントアラート')
      .setDescription('ON/OFF')
      .addBooleanOption(o =>
        o.setName('状態').setRequired(true)
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
// interaction
// ===============================

client.on('interactionCreate', async i => {

  if (!i.isChatInputCommand()) return;

  if (
    i.commandName !== '監視' &&
    i.commandName !== '設定確認' &&
    i.commandName !== 'サーバー情報' &&
    !hasPerm(i)
  ) {
    return i.reply({ content: '権限なし', ephemeral: true });
  }

  // ===============================
  // 監視
  // ===============================
  if (i.commandName === '監視') {
    settings.monitorEnabled = i.options.getBoolean('状態');
    saveSettings();
    return i.reply({ content: 'OK', ephemeral: true });
  }

  // ===============================
  // 設定確認
  // ===============================
  if (i.commandName === '設定確認') {
    return i.reply({
      content:
        `監視:${settings.monitorEnabled}\n` +
        `リンク:${settings.linkAlertEnabled}\n` +
        `新規:${settings.newAccountAlertEnabled}`,
      ephemeral: true
    });
  }

  // ===============================
  // サーバー情報
  // ===============================
  if (i.commandName === 'サーバー情報') {
    const g = i.guild;

    const bots = g.members.cache.filter(m => m.user.bot).size;
    const users = g.members.cache.filter(m => !m.user.bot).size;

    return i.reply({
      content:
        `合計:${g.memberCount}\nユーザー:${users}\nBOT:${bots}`,
      ephemeral: true
    });
  }

  // ===============================
  // パネル
  // ===============================
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
// message
// ===============================

client.on('messageCreate', m => {

  if (m.author.bot) return;
  if (!settings.monitorEnabled) return;

  if (settings.linkAlertEnabled) {

    if (/(https?:\/\/)/.test(m.content)) {

      const ch = m.guild.channels.cache.get(settings.alertChannelId);
      if (!ch) return;

      ch.send(`リンク: ${m.author.tag}\n${m.content}`);
    }

  }

});

// ===============================
// login
// ===============================

client.login(TOKEN);
