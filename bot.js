const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ChannelType
} = require('discord.js');

const { load, save } = require('./settings');

const TOKEN = 'MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =====================
// 安全関数
// =====================
const safeStr = (v, f = "未設定") =>
  typeof v === "string" && v.trim().length ? v : f;

// =====================
// 権限ロールチェック
// =====================
function hasPermission(i, settings) {
  if (i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (!settings.allowedRoles?.length) return false;
  return i.member.roles.cache.some(r => settings.allowedRoles.includes(r.id));
}

// =====================
// アラート必須チェック
// =====================
function requireAlert(i, settings) {
  if (!settings.alertChannelId) {
    i.reply({ content: "先にアラートチャンネルを設定してください", ephemeral: true });
    return false;
  }
  return true;
}

// =====================
// 起動
// =====================
client.once('ready', async () => {
  console.log(`${client.user.tag} ready`);

  const cmds = [

    // アラートチャンネル
    new SlashCommandBuilder()
      .setName('alert')
      .setDescription('アラート設定')
      .addSubcommand(s =>
        s.setName('set')
          .setDescription('チャンネル設定')
          .addChannelOption(o =>
            o.setName('channel').setDescription('チャンネル').setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('off').setDescription('無効化')
      ),

    // リンク監視
    new SlashCommandBuilder()
      .setName('link')
      .setDescription('リンク監視')
      .addSubcommand(s =>
        s.setName('on')
      )
      .addSubcommand(s =>
        s.setName('off')
      ),

    // プレイヤー監視
    new SlashCommandBuilder()
      .setName('player')
      .setDescription('参加監視')
      .addSubcommand(s =>
        s.setName('on')
      )
      .addSubcommand(s =>
        s.setName('off')
      ),

    // ロール許可
    new SlashCommandBuilder()
      .setName('role')
      .setDescription('コマンドロール')
      .addSubcommand(s =>
        s.setName('add')
          .addRoleOption(o =>
            o.setName('role').setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('clear')
      ),

    // 説明＋ボタン投稿
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('説明＆ボタン')
      .addSubcommand(s =>
        s.setName('setchannel')
          .addChannelOption(o =>
            o.setName('channel').setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('post')
      ),

    // 表示先設定確認
    new SlashCommandBuilder()
      .setName('panelview')
      .setDescription('表示チャンネル確認'),

    // サーバー情報
    new SlashCommandBuilder()
      .setName('server')
      .setDescription('サーバー情報'),

    // 全状態
    new SlashCommandBuilder()
      .setName('status')
      .setDescription('全ON/OFF確認')

  ].map(c => c.toJSON());

  await client.application.commands.set(cmds);
});

// =====================
// interaction
// =====================
client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand()) return;

  let settings = load();

  // =====================
  // alert channel
  // =====================
  if (i.commandName === 'alert') {

    if (!hasPermission(i, settings))
      return i.reply({ content: "権限なし", ephemeral: true });

    const sub = i.options.getSubcommand();

    if (sub === 'set') {
      const ch = i.options.getChannel('channel');

      settings.alertChannelId = ch.id;
      save(settings);

      return i.reply({ content: "設定完了", ephemeral: true });
    }

    if (sub === 'off') {
      settings.alertChannelId = null;
      save(settings);

      return i.reply({ content: "無効化", ephemeral: true });
    }
  }

  // =====================
  // link monitor
  // =====================
  if (i.commandName === 'link') {

    if (!hasPermission(i, settings))
      return i.reply({ content: "権限なし", ephemeral: true });

    if (!requireAlert(i, settings)) return;

    const sub = i.options.getSubcommand();

    settings.linkAlertEnabled = (sub === 'on');
    save(settings);

    return i.reply({
      content: `リンク監視:${settings.linkAlertEnabled}`,
      ephemeral: true
    });
  }

  // =====================
  // player monitor
  // =====================
  if (i.commandName === 'player') {

    if (!hasPermission(i, settings))
      return i.reply({ content: "権限なし", ephemeral: true });

    if (!requireAlert(i, settings)) return;

    const sub = i.options.getSubcommand();

    settings.playerMonitorEnabled = (sub === 'on');
    save(settings);

    return i.reply({
      content: `参加監視:${settings.playerMonitorEnabled}`,
      ephemeral: true
    });
  }

  // =====================
  // role allow
  // =====================
  if (i.commandName === 'role') {

    if (!hasPermission(i, settings))
      return i.reply({ content: "権限なし", ephemeral: true });

    const sub = i.options.getSubcommand();

    if (sub === 'add') {
      const role = i.options.getRole('role');

      if (!settings.allowedRoles.includes(role.id)) {
        settings.allowedRoles.push(role.id);
        save(settings);
      }

      return i.reply({ content: "追加完了", ephemeral: true });
    }

    if (sub === 'clear') {
      settings.allowedRoles = [];
      save(settings);

      return i.reply({ content: "全削除", ephemeral: true });
    }
  }

  // =====================
  // panel
  // =====================
  if (i.commandName === 'panel') {

    if (!hasPermission(i, settings))
      return i.reply({ content: "権限なし", ephemeral: true });

    const sub = i.options.getSubcommand();

    if (sub === 'setchannel') {
      const ch = i.options.getChannel('channel');

      settings.panelChannelId = ch.id;
      save(settings);

      return i.reply({ content: "設定完了", ephemeral: true });
    }

    if (sub === 'post') {

      if (!settings.panelChannelId)
        return i.reply({ content: "チャンネル未設定", ephemeral: true });

      const ch = i.guild.channels.cache.get(settings.panelChannelId);
      if (!ch) return;

      const embed = new EmbedBuilder()
        .setDescription(safeStr(settings.panelText));

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('panel_button')
          .setLabel('実行')
          .setStyle(ButtonStyle.Primary)
      );

      await ch.send({ embeds: [embed], components: [row] });

      return i.reply({ content: "送信完了", ephemeral: true });
    }
  }

  // =====================
  // panel view
  // =====================
  if (i.commandName === 'panelview') {

    return i.reply({
      ephemeral: true,
      content:
`表示チャンネル:${settings.panelChannelId ?? "未設定"}
説明:${safeStr(settings.panelText)}`
    });
  }

  // =====================
  // server info
  // =====================
  if (i.commandName === 'server') {

    const g = i.guild;

    return i.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(g.name)
          .setThumbnail(g.iconURL())
          .addFields(
            { name: "メンバー", value: `${g.memberCount}`, inline: true },
            { name: "ブースト", value: `${g.premiumSubscriptionCount ?? 0}`, inline: true }
          )
      ]
    });
  }

  // =====================
  // status all
  // =====================
  if (i.commandName === 'status') {

    return i.reply({
      ephemeral: true,
      content:
`アラート:${settings.alertChannelId ? "ON" : "OFF"}
リンク:${settings.linkAlertEnabled}
参加:${settings.playerMonitorEnabled}`
    });
  }
});

// =====================
// link detect
// =====================
client.on('messageCreate', m => {

  if (m.author.bot) return;

  const settings = load();

  if (!settings.linkAlertEnabled) return;
  if (!settings.alertChannelId) return;

  if (/(https?:\/\/)/.test(m.content)) {

    const ch = m.guild.channels.cache.get(settings.alertChannelId);
    if (!ch) return;

    ch.send(`リンク検知\n${m.author.tag}\n${m.content}`);
  }
});

client.login(TOKEN);
