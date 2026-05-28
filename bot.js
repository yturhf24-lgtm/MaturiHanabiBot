const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
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
      .setName('パネル')
      .setDescription('管理パネル表示'),

    new SlashCommandBuilder()
      .setName('設定確認')
      .setDescription('状態確認'),

    new SlashCommandBuilder()
      .setName('サーバー情報')
      .setDescription('サーバー情報表示')

  ].map(c => c.toJSON());

  await client.application.commands.set(cmds);
});

// ===============================
// コマンド
// ===============================

client.on('interactionCreate', async i => {

  settings = load();

  // =========================
  // パネル
  // =========================
  if (i.isChatInputCommand() && i.commandName === 'パネル') {

    const embed = new EmbedBuilder()
      .setTitle('管理パネル')
      .setDescription(settings.panelText);

    const row = new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId('toggle_monitor')
        .setLabel('監視')
        .setStyle(ButtonStyle.Primary),

      new ButtonBuilder()
        .setCustomId('toggle_link')
        .setLabel('リンク')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('toggle_new')
        .setLabel('新規')
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('edit_text')
        .setLabel('説明編集')
        .setStyle(ButtonStyle.Success)

    );

    return i.reply({
      embeds: [embed],
      components: [row]
    });
  }

  // =========================
  // 設定確認
  // =========================
  if (i.isChatInputCommand() && i.commandName === '設定確認') {

    return i.reply({
      content:
`監視:${settings.monitorEnabled}
リンク:${settings.linkAlertEnabled}
新規:${settings.newAccountAlertEnabled}`,
      ephemeral: true
    });
  }

  // =========================
  // サーバー情報
  // =========================
  if (i.isChatInputCommand() && i.commandName === 'サーバー情報') {

    const g = i.guild;

    const users = g.members.cache.filter(m => !m.user.bot).size;
    const bots = g.members.cache.filter(m => m.user.bot).size;

    return i.reply({
      content:
`サーバー名:${g.name}
合計:${g.memberCount}
ユーザー:${users}
Bot:${bots}`,
      ephemeral: true
    });
  }

  // =========================
  // ボタン処理
  // =========================
  if (i.isButton()) {

    settings = load();

    if (i.customId === 'toggle_monitor') {
      settings.monitorEnabled = !settings.monitorEnabled;
      save(settings);

      return i.reply({ content: `監視:${settings.monitorEnabled}`, ephemeral: true });
    }

    if (i.customId === 'toggle_link') {
      settings.linkAlertEnabled = !settings.linkAlertEnabled;
      save(settings);

      return i.reply({ content: `リンク:${settings.linkAlertEnabled}`, ephemeral: true });
    }

    if (i.customId === 'toggle_new') {
      settings.newAccountAlertEnabled = !settings.newAccountAlertEnabled;
      save(settings);

      return i.reply({ content: `新規:${settings.newAccountAlertEnabled}`, ephemeral: true });
    }

    if (i.customId === 'edit_text') {

      const modal = new ModalBuilder()
        .setCustomId('edit_modal')
        .setTitle('説明編集');

      const input = new TextInputBuilder()
        .setCustomId('text')
        .setLabel('説明')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const row = new ActionRowBuilder().addComponents(input);
      modal.addComponents(row);

      return i.showModal(modal);
    }
  }

  // =========================
  // モーダル処理
  // =========================
  if (i.isModalSubmit() && i.customId === 'edit_modal') {

    settings.panelText = i.fields.getTextInputValue('text');
    save(settings);

    return i.reply({
      content: '説明更新完了',
      ephemeral: true
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
