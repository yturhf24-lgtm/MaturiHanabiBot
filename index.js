const express = require('express');
const fs = require('fs');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
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
// 保存ファイル
// ===============================

const SETTINGS_FILE = './settings.json';

// ===============================
// 設定
// ===============================

let settings = {
  monitorEnabled: true,
  alertChannelId: null,
  linkAlertEnabled: true,
  newAccountAlertEnabled: true,
  allowedRoleIds: [],
  panelDescription: 'ここに説明文'
};

// ===============================
// 設定ロード
// ===============================

if (fs.existsSync(SETTINGS_FILE)) {

  const data = fs.readFileSync(
    SETTINGS_FILE,
    'utf8'
  );

  settings = JSON.parse(data);

}

// ===============================
// 保存
// ===============================

function saveSettings() {

  fs.writeFileSync(
    SETTINGS_FILE,
    JSON.stringify(settings, null, 2)
  );

}

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
    // 設定確認
    // ===============================

    new SlashCommandBuilder()
      .setName('設定確認')
      .setDescription('現在の設定確認'),

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
      ),

    // ===============================
    // パネル説明変更
    // ===============================

    new SlashCommandBuilder()
      .setName('説明変更')
      .setDescription('ボタン説明変更')
      .addStringOption(option =>
        option
          .setName('内容')
          .setDescription('説明文')
          .setRequired(true)
      ),

    // ===============================
    // パネル送信
    // ===============================

    new SlashCommandBuilder()
      .setName('パネル')
      .setDescription('ボタン付きパネル送信')

  ].map(command => command.toJSON());

  await client.application.commands.set(commands);

  console.log('✅ Slash Commands 登録完了');

});

// ===============================
// Slash Commands
// ===============================

client.on('interactionCreate', async interaction => {

  // ===============================
  // ボタン処理
  // ===============================

  if (interaction.isButton()) {

    if (interaction.customId === 'open_ticket') {

      return interaction.reply({
        content:
`✅ ボタンが押されました

必要ならここに
チケット作成処理など追加可能`,
        ephemeral: true
      });

    }

  }

  // ===============================
  // Slash Commandのみ
  // ===============================

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
      role =>
        settings.allowedRoleIds.includes(
          role.id
        )
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

    if (
      !settings.allowedRoleIds.includes(
        role.id
      )
    ) {

      settings.allowedRoleIds.push(role.id);

      saveSettings();

    }

    return interaction.reply({
      content:
`✅ ${role} をコマンド使用可能に設定`,
      ephemeral: true
    });

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

    settings.allowedRoleIds =
      settings.allowedRoleIds.filter(
        id => id !== role.id
      );

    saveSettings();

    return interaction.reply({
      content:
`✅ ${role} の権限を剥奪`,
      ephemeral: true
    });

  }

  // ===============================
  // /監視
  // ===============================

  if (interaction.commandName === '監視') {

    settings.monitorEnabled =
      interaction.options.getBoolean('状態');

    saveSettings();

    return interaction.reply({
      content:
`✅ 監視: ${
settings.monitorEnabled
? 'ON'
: 'OFF'
}`,
      ephemeral: true
    });

  }

  // ===============================
  // /アラートチャンネル
  // ===============================

  if (
    interaction.commandName ===
    'アラートチャンネル'
  ) {

    const channel =
      interaction.options.getChannel(
        'チャンネル'
      );

    settings.alertChannelId =
      channel.id;

    saveSettings();

    return interaction.reply({
      content:
`✅ アラートチャンネル設定: ${channel}`,
      ephemeral: true
    });

  }

  // ===============================
  // /リンクアラート
  // ===============================

  if (
    interaction.commandName ===
    'リンクアラート'
  ) {

    settings.linkAlertEnabled =
      interaction.options.getBoolean('状態');

    saveSettings();

    return interaction.reply({
      content:
`✅ リンクアラート: ${
settings.linkAlertEnabled
? 'ON'
: 'OFF'
}`,
      ephemeral: true
    });

  }

  // ===============================
  // /新規アカウントアラート
  // ===============================

  if (
    interaction.commandName ===
    '新規アカウントアラート'
  ) {

    settings.newAccountAlertEnabled =
      interaction.options.getBoolean('状態');

    saveSettings();

    return interaction.reply({
      content:
`✅ 新規アカウント監視: ${
settings.newAccountAlertEnabled
? 'ON'
: 'OFF'
}`,
      ephemeral: true
    });

  }

  // ===============================
  // /設定確認
  // ===============================

  if (
    interaction.commandName ===
    '設定確認'
  ) {

    return interaction.reply({
      content:
`⚙ 現在の設定

👁 監視:
${settings.monitorEnabled ? 'ON' : 'OFF'}

🔗 リンク監視:
${settings.linkAlertEnabled ? 'ON' : 'OFF'}

🆕 新規アカウント監視:
${
settings.newAccountAlertEnabled
? 'ON'
: 'OFF'
}

📢 アラートチャンネル:
${
settings.alertChannelId
? `<#${settings.alertChannelId}>`
: '未設定'
}

🎭 権限ロール数:
${settings.allowedRoleIds.length}`,
      ephemeral: true
    });

  }

  // ===============================
  // /サーバー情報
  // ===============================

  if (
    interaction.commandName ===
    'サーバー情報'
  ) {

    return interaction.reply({
      content:
`📊 サーバー情報

👥 メンバー数:
${guild.memberCount}

📝 チャンネル数:
${guild.channels.cache.size}

🎭 ロール数:
${guild.roles.cache.size}

👑 サーバー名:
${guild.name}`,
      ephemeral: true
    });

  }

  // ===============================
  // /説明変更
  // ===============================

  if (
    interaction.commandName ===
    '説明変更'
  ) {

    const text =
      interaction.options.getString('内容');

    settings.panelDescription = text;

    saveSettings();

    return interaction.reply({
      content:
`✅ 説明文を変更しました`,
      ephemeral: true
    });

  }

  // ===============================
  // /パネル
  // ===============================

  if (
    interaction.commandName ===
    'パネル'
  ) {

    const embed = new EmbedBuilder()
      .setTitle('サポートパネル')
      .setDescription(
        settings.panelDescription
      )
      .setColor('Blue');

    const row =
      new ActionRowBuilder()
        .addComponents(

          new ButtonBuilder()
            .setCustomId('open_ticket')
            .setLabel('開く')
            .setStyle(ButtonStyle.Success)

        );

    return interaction.reply({
      embeds: [embed],
      components: [row]
    });

  }

});

// ===============================
// メッセージ監視
// ===============================

client.on('messageCreate', async message => {

  if (message.author.bot) return;

  if (!settings.monitorEnabled) return;

  // ===============================
  // リンク検知
  // ===============================

  if (
    settings.linkAlertEnabled &&
    /(https?:\/\/[^\s]+)/g.test(
      message.content
    )
  ) {

    if (settings.alertChannelId) {

      const channel =
        message.guild.channels.cache.get(
          settings.alertChannelId
        );

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

client.on(
  'guildMemberAdd',
  async member => {

    if (
      !settings.newAccountAlertEnabled
    ) return;

    if (!settings.alertChannelId)
      return;

    const accountAge =
      Date.now() -
      member.user.createdTimestamp;

    const days = Math.floor(
      accountAge /
      (1000 * 60 * 60 * 24)
    );

    if (days <= 10) {

      const channel =
        member.guild.channels.cache.get(
          settings.alertChannelId
        );

      if (channel) {

        channel.send(
`🚨 新規アカウント検知

👤 ${member.user.tag}
📅 作成日数: ${days}日
🆔 ${member.id}`
        );

      }

    }

  }
);

// ===============================
// ログイン
// ===============================

client.login(TOKEN);
