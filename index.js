const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionsBitField,
  ChannelType
} = require('discord.js');

// ===============================
// BOT
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
// TOKEN
// ===============================

const TOKEN = 'MTM1MzM5MzE5NDQxNDYzNzE5OA.GXgtZG.SDW89nKd9GSYjsBh7BJgMDPy_jTbTG-n_pM56Y';

// ===============================
// /コマンド使用可能ロール
// このロール持ちだけ使用可能
// ===============================

const allowedRoleIds = [
  'ここに許可ロールID'
];

// ===============================
// 設定
// ===============================

let monitorEnabled = true;

let alertChannelId = null;

let linkAlertEnabled = true;

let newAccountAlertEnabled = true;

// ===============================
// 起動
// ===============================

client.once('ready', async () => {

  console.log(`✅ ${client.user.tag} 起動完了`);

  // ===============================
  // Slash Commands
  // ===============================

  const commands = [

    new SlashCommandBuilder()
      .setName('監視')
      .setDescription('監視ON/OFF')
      .addBooleanOption(option =>
        option
          .setName('状態')
          .setDescription('true = ON / false = OFF')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('アラートチャンネル')
      .setDescription('アラート送信先')
      .addChannelOption(option =>
        option
          .setName('チャンネル')
          .setDescription('送信先')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('リンクアラート')
      .setDescription('リンク監視ON/OFF')
      .addBooleanOption(option =>
        option
          .setName('状態')
          .setDescription('ON/OFF')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('新規アカウントアラート')
      .setDescription('10日以内アカウント検知')
      .addBooleanOption(option =>
        option
          .setName('状態')
          .setDescription('ON/OFF')
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('サーバー情報')
      .setDescription('サーバー情報表示')

  ].map(command => command.toJSON());

  await client.application.commands.set(commands);

  console.log('✅ Slash Commands 登録完了');

});

// ===============================
// Slash Commands
// ===============================

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  // ===============================
  // ロール権限チェック
  // ===============================

  const hasRole = interaction.member.roles.cache.some(
    role => allowedRoleIds.includes(role.id)
  );

  if (!hasRole) {

    return interaction.reply({
      content: '❌ このコマンドを使う権限がありません',
      ephemeral: true
    });

  }

  // ===============================
  // /監視
  // ===============================

  if (interaction.commandName === '監視') {

    monitorEnabled =
      interaction.options.getBoolean('状態');

    return interaction.reply(
      `✅ 監視: ${monitorEnabled ? 'ON' : 'OFF'}`
    );
  }

  // ===============================
  // /アラートチャンネル
  // ===============================

  if (interaction.commandName === 'アラートチャンネル') {

    const channel =
      interaction.options.getChannel('チャンネル');

    alertChannelId = channel.id;

    return interaction.reply(
      `✅ アラートチャンネル設定: ${channel}`
    );
  }

  // ===============================
  // /リンクアラート
  // ===============================

  if (interaction.commandName === 'リンクアラート') {

    linkAlertEnabled =
      interaction.options.getBoolean('状態');

    return interaction.reply(
      `✅ リンクアラート: ${linkAlertEnabled ? 'ON' : 'OFF'}`
    );
  }

  // ===============================
  // /新規アカウントアラート
  // ===============================

  if (interaction.commandName === '新規アカウントアラート') {

    newAccountAlertEnabled =
      interaction.options.getBoolean('状態');

    return interaction.reply(
      `✅ 新規アカウント監視: ${newAccountAlertEnabled ? 'ON' : 'OFF'}`
    );
  }

  // ===============================
  // /サーバー情報
  // ===============================

  if (interaction.commandName === 'サーバー情報') {

    const guild = interaction.guild;

    return interaction.reply({
      content:
`📊 サーバー情報

👥 メンバー数: ${guild.memberCount}
📝 チャンネル数: ${guild.channels.cache.size}
🎭 ロール数: ${guild.roles.cache.size}
👑 サーバー名: ${guild.name}`
    });
  }

});

// ===============================
// メッセージ監視
// ===============================

client.on('messageCreate', async message => {

  if (message.author.bot) return;

  if (!monitorEnabled) return;

  // ===============================
  // リンク監視
  // ===============================

  if (
    linkAlertEnabled &&
    /(https?:\/\/[^\s]+)/g.test(message.content)
  ) {

    if (alertChannelId) {

      const channel =
        message.guild.channels.cache.get(alertChannelId);

      if (channel) {

        channel.send(
`🚨 リンク検知

👤 ${message.author.tag}
📍 ${message.channel}

${message.content}`
        );

      }

    }

  }

});

// ===============================
// 新規アカウント監視
// ===============================

client.on('guildMemberAdd', async member => {

  if (!newAccountAlertEnabled) return;

  if (!alertChannelId) return;

  const accountAge =
    Date.now() - member.user.createdTimestamp;

  const days = Math.floor(
    accountAge / (1000 * 60 * 60 * 24)
  );

  if (days <= 10) {

    const channel =
      member.guild.channels.cache.get(alertChannelId);

    if (channel) {

      channel.send(
`🚨 新規アカウント検知

👤 ${member.user.tag}
📅 作成日数: ${days}日
🆔 ${member.id}`
      );

    }

  }

});

// ===============================
// ログイン
// ===============================

client.login(TOKEN);
