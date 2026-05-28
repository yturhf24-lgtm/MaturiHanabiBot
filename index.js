const express = require('express');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType
} = require('discord.js');

// ===============================
// Express
// ===============================

const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('BOT ONLINE');
});

app.listen(PORT, () => {
  console.log(`🌐 Web Server 起動: ${PORT}`);
});

// ===============================
// Discord Bot
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
// コマンド使用可能ロール
// ===============================

let allowedRoleIds = [];

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

  const commands = [

    // ===============================
    // 監視
    // ===============================

    new SlashCommandBuilder()
      .setName('監視')
      .setDescription('監視ON/OFF')
      .addBooleanOption(option =>
        option
          .setName('状態')
          .setDescription('ON/OFF')
          .setRequired(true)
      ),

    // ===============================
    // アラートチャンネル
    // ===============================

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

    // ===============================
    // リンクアラート
    // ===============================

    new SlashCommandBuilder()
      .setName('リンクアラート')
      .setDescription('リンク監視')
      .addBooleanOption(option =>
        option
          .setName('状態')
          .setDescription('ON/OFF')
          .setRequired(true)
      ),

    // ===============================
    // 新規アカウントアラート
    // ===============================

    new SlashCommandBuilder()
      .setName('新規アカウントアラート')
      .setDescription('10日以内アカウント監視')
      .addBooleanOption(option =>
        option
          .setName('状態')
          .setDescription('ON/OFF')
          .setRequired(true)
      ),

    // ===============================
    // サーバー情報
    // ===============================

    new SlashCommandBuilder()
      .setName('サーバー情報')
      .setDescription('サーバー情報表示'),

    // ===============================
    // コマンド権限許可
    // ===============================

    new SlashCommandBuilder()
      .setName('コマンド権限許可')
      .setDescription('/コマンド使用可能ロール追加')
      .addRoleOption(option =>
        option
          .setName('ロール')
          .setDescription('許可するロール')
          .setRequired(true)
      ),

    // ===============================
    // コマンド権限剥奪
    // ===============================

    new SlashCommandBuilder()
      .setName('コマンド権限剥奪')
      .setDescription('/コマンド使用可能ロール削除')
      .addRoleOption(option =>
        option
          .setName('ロール')
          .setDescription('削除するロール')
          .setRequired(true)
      )

  ].map(command => command.toJSON());

  await client.application.commands.set(commands);

  console.log('✅ Slash Commands 登録完了');

});

// ===============================
// Slash Commands
// ===============================

client.on('interactionCreate', async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const guild = interaction.guild;

  // ===============================
  // サーバー所有者
  // ===============================

  const isOwner =
    interaction.user.id === guild.ownerId;

  // ===============================
  // 権限ロール所持
  // ===============================

  const hasAllowedRole =
    interaction.member.roles.cache.some(
      role => allowedRoleIds.includes(role.id)
    );

  // ===============================
  // 権限チェック
  // ===============================

  if (
    !isOwner &&
    !hasAllowedRole &&
    interaction.commandName !== 'コマンド権限許可' &&
    interaction.commandName !== 'コマンド権限剥奪'
  ) {

    return interaction.reply({
      content: '❌ 権限なし',
      ephemeral: true
    });

  }

  // ===============================
  // /コマンド権限許可
  // ===============================

  if (interaction.commandName === 'コマンド権限許可') {

    if (!isOwner) {

      return interaction.reply({
        content: '❌ サーバー所有者限定',
        ephemeral: true
      });

    }

    const role =
      interaction.options.getRole('ロール');

    if (!allowedRoleIds.includes(role.id)) {

      allowedRoleIds.push(role.id);

    }

    return interaction.reply(
      `✅ ${role} をコマンド使用可能に設定`
    );

  }

  // ===============================
  // /コマンド権限剥奪
  // ===============================

  if (interaction.commandName === 'コマンド権限剥奪') {

    if (!isOwner) {

      return interaction.reply({
        content: '❌ サーバー所有者限定',
        ephemeral: true
      });

    }

    const role =
      interaction.options.getRole('ロール');

    allowedRoleIds =
      allowedRoleIds.filter(
        id => id !== role.id
      );

    return interaction.reply(
      `✅ ${role} の権限を剥奪`
    );

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

  if (
    interaction.commandName ===
    '新規アカウントアラート'
  ) {

    newAccountAlertEnabled =
      interaction.options.getBoolean('状態');

    return interaction.reply(
      `✅ 新規アカウント監視: ${
        newAccountAlertEnabled ? 'ON' : 'OFF'
      }`
    );

  }

  // ===============================
  // /サーバー情報
  // ===============================

  if (interaction.commandName === 'サーバー情報') {

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
  // リンク検知
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
// 新規アカウント検知
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
