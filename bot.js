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

const TOKEN = 'MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s';

let settings = load();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ]
});

// =====================
// 起動
// =====================
client.once('ready', async () => {
  console.log(client.user.tag + ' Ready');

  const cmds = [
    new SlashCommandBuilder().setName('パネル').setDescription('管理UI'),
    new SlashCommandBuilder().setName('設定確認').setDescription('設定確認'),
    new SlashCommandBuilder().setName('サーバー情報').setDescription('情報表示'),
    new SlashCommandBuilder().setName('チャンネル設定').setDescription('チャンネル設定')
  ].map(c => c.toJSON());

  await client.application.commands.set(cmds);
});

// =====================
// コマンド処理
// =====================
client.on('interactionCreate', async i => {

  settings = load();

  // ───────────────
  // パネル
  // ───────────────
  if (i.isChatInputCommand() && i.commandName === 'パネル') {

    const embed = new EmbedBuilder()
      .setTitle('管理パネル')
      .setDescription(settings.panelText);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('monitor').setLabel('監視').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('link').setLabel('リンク').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('new').setLabel('新規').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('edit').setLabel('説明編集').setStyle(ButtonStyle.Success)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  // ───────────────
  // 設定確認
  // ───────────────
  if (i.isChatInputCommand() && i.commandName === '設定確認') {

    return i.reply({
      content:
`監視:${settings.monitorEnabled}
リンク:${settings.linkAlertEnabled}
新規:${settings.newAccountAlertEnabled}
チャンネル:${settings.alertChannelId ? '設定済み' : '未設定'}`,
      ephemeral: true
    });
  }

  // ───────────────
  // チャンネル設定
  // ───────────────
  if (i.isChatInputCommand() && i.commandName === 'チャンネル設定') {

    const embed = new EmbedBuilder()
      .setTitle('アラートチャンネル')
      .setDescription(settings.alertChannelId ? `<#${settings.alertChannelId}>` : '未設定');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('set_channel').setLabel('設定').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('clear_channel').setLabel('削除').setStyle(ButtonStyle.Danger)
    );

    return i.reply({ embeds: [embed], components: [row] });
  }

  // ───────────────
  // サーバー情報（完成UI）
  // ───────────────
  if (i.isChatInputCommand() && i.commandName === 'サーバー情報') {

    const g = i.guild;

    const members = g.memberCount;
    const users = g.members.cache.filter(m => !m.user.bot).size;
    const bots = g.members.cache.filter(m => m.user.bot).size;

    const text = g.channels.cache.filter(c => c.type === 0).size;
    const voice = g.channels.cache.filter(c => c.type === 2).size;
    const cat = g.channels.cache.filter(c => c.type === 4).size;

    const boost = g.premiumSubscriptionCount || 0;
    const level = g.premiumTier;

    const created = g.createdAt.toISOString().split('T')[0];

    const online = g.members.cache.filter(m => m.presence?.status === 'online').size;
    const offline = members - online;

    const inactivity = Math.min(100, Math.round((bots / members) * 100));

    const embed = new EmbedBuilder()
      .setTitle(`${g.name} サーバー情報`)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .addFields(
        {
          name: 'メンバー',
          value: `総数:${members}\nユーザー:${users}\nBot:${bots}`,
          inline: true
        },
        {
          name: 'ステータス',
          value: `🟢${online}\n⚫${offline}`,
          inline: true
        },
        {
          name: 'チャンネル',
          value: `テキスト:${text}\nボイス:${voice}\nカテゴリ:${cat}`,
          inline: true
        },
        {
          name: 'ブースト',
          value: `Lv:${level}\n回数:${boost}`,
          inline: true
        },
        {
          name: '作成日',
          value: created,
          inline: true
        },
        {
          name: '過疎度',
          value: `${inactivity}%`,
          inline: true
        }
      )
      .setColor(0x2b2d31);

    return i.reply({ embeds: [embed] });
  }

  // ───────────────
  // ボタン
  // ───────────────
  if (i.isButton()) {

    settings = load();

    if (i.customId === 'monitor') {
      settings.monitorEnabled = !settings.monitorEnabled;
      save(settings);
      return i.reply({ content: `監視:${settings.monitorEnabled}`, ephemeral: true });
    }

    if (i.customId === 'link') {
      settings.linkAlertEnabled = !settings.linkAlertEnabled;
      save(settings);
      return i.reply({ content: `リンク:${settings.linkAlertEnabled}`, ephemeral: true });
    }

    if (i.customId === 'new') {
      settings.newAccountAlertEnabled = !settings.newAccountAlertEnabled;
      save(settings);
      return i.reply({ content: `新規:${settings.newAccountAlertEnabled}`, ephemeral: true });
    }

    if (i.customId === 'set_channel') {

      const modal = new ModalBuilder()
        .setCustomId('channel_modal')
        .setTitle('チャンネル設定');

      const input = new TextInputBuilder()
        .setCustomId('channel')
        .setLabel('チャンネルID')
        .setStyle(TextInputStyle.Short);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return i.showModal(modal);
    }

    if (i.customId === 'clear_channel') {
      settings.alertChannelId = null;
      save(settings);
      return i.reply({ content: '削除完了', ephemeral: true });
    }

    if (i.customId === 'edit') {

      const modal = new ModalBuilder()
        .setCustomId('text_modal')
        .setTitle('説明編集');

      const input = new TextInputBuilder()
        .setCustomId('text')
        .setLabel('説明')
        .setStyle(TextInputStyle.Paragraph);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      return i.showModal(modal);
    }
  }

  // ───────────────
  // モーダル
  // ───────────────
  if (i.isModalSubmit()) {

    settings = load();

    if (i.customId === 'channel_modal') {
      settings.alertChannelId = i.fields.getTextInputValue('channel');
      save(settings);
      return i.reply({ content: '設定完了', ephemeral: true });
    }

    if (i.customId === 'text_modal') {
      settings.panelText = i.fields.getTextInputValue('text');
      save(settings);
      return i.reply({ content: '更新完了', ephemeral: true });
    }
  }
});

// =====================
// リンク監視
// =====================
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

// =====================
client.login(TOKEN);
