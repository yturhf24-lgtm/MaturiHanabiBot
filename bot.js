const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
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
// util
// =====================
const isAdmin = (i, s) => {
  if (i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (!s.allowedRoles?.length) return false;
  return i.member.roles.cache.some(r => s.allowedRoles.includes(r.id));
};

const requireAlert = (i, s) => {
  if (!s.alertChannelId) {
    i.reply({ content: "アラートチャンネル未設定", ephemeral: true });
    return false;
  }
  return true;
};

// =====================
// ready
// =====================
client.once('ready', async () => {
  console.log(`${client.user.tag} Ready`);

  const cmds = [

    // alert
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
        s.setName('off')
          .setDescription('無効化')
      ),

    // link
    new SlashCommandBuilder()
      .setName('link')
      .setDescription('リンク監視')
      .addSubcommand(s =>
        s.setName('on').setDescription('ON')
      )
      .addSubcommand(s =>
        s.setName('off').setDescription('OFF')
      ),

    // player
    new SlashCommandBuilder()
      .setName('player')
      .setDescription('参加監視')
      .addSubcommand(s =>
        s.setName('on').setDescription('ON')
      )
      .addSubcommand(s =>
        s.setName('off').setDescription('OFF')
      ),

    // role
    new SlashCommandBuilder()
      .setName('role')
      .setDescription('ロール管理')
      .addSubcommand(s =>
        s.setName('add')
          .setDescription('追加')
          .addRoleOption(o =>
            o.setName('role').setDescription('ロール').setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('clear')
          .setDescription('全削除')
      ),

    // panel
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('説明＆ボタン')
      .addSubcommand(s =>
        s.setName('setchannel')
          .setDescription('チャンネル指定')
          .addChannelOption(o =>
            o.setName('channel').setDescription('チャンネル').setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('post')
          .setDescription('送信')
      ),

    // server
    new SlashCommandBuilder()
      .setName('server')
      .setDescription('サーバー情報'),

    // status
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

  await i.deferReply({ ephemeral: true });

  let s;

  try {
    s = load();
  } catch {
    return i.editReply("設定エラー");
  }

  try {

    // =====================
    // alert
    // =====================
    if (i.commandName === 'alert') {

      if (!isAdmin(i, s)) return i.editReply("権限なし");

      const sub = i.options.getSubcommand();

      if (sub === 'set') {
        const ch = i.options.getChannel('channel');
        s.alertChannelId = ch.id;
        save(s);
        return i.editReply("設定完了");
      }

      if (sub === 'off') {
        s.alertChannelId = null;
        save(s);
        return i.editReply("OFF");
      }
    }

    // =====================
    // link
    // =====================
    if (i.commandName === 'link') {

      if (!isAdmin(i, s)) return i.editReply("権限なし");
      if (!requireAlert(i, s)) return;

      const sub = i.options.getSubcommand();
      s.linkAlertEnabled = sub === 'on';
      save(s);

      return i.editReply(`リンク:${s.linkAlertEnabled}`);
    }

    // =====================
    // player
    // =====================
    if (i.commandName === 'player') {

      if (!isAdmin(i, s)) return i.editReply("権限なし");
      if (!requireAlert(i, s)) return;

      const sub = i.options.getSubcommand();
      s.playerMonitorEnabled = sub === 'on';
      save(s);

      return i.editReply(`参加:${s.playerMonitorEnabled}`);
    }

    // =====================
    // role
    // =====================
    if (i.commandName === 'role') {

      if (!isAdmin(i, s)) return i.editReply("権限なし");

      const sub = i.options.getSubcommand();

      if (sub === 'add') {
        const role = i.options.getRole('role');
        if (!s.allowedRoles.includes(role.id)) {
          s.allowedRoles.push(role.id);
          save(s);
        }
        return i.editReply("追加");
      }

      if (sub === 'clear') {
        s.allowedRoles = [];
        save(s);
        return i.editReply("削除");
      }
    }

    // =====================
    // panel
    // =====================
    if (i.commandName === 'panel') {

      if (!isAdmin(i, s)) return i.editReply("権限なし");

      const sub = i.options.getSubcommand();

      if (sub === 'setchannel') {
        const ch = i.options.getChannel('channel');
        s.panelChannelId = ch.id;
        save(s);
        return i.editReply("設定完了");
      }

      if (sub === 'post') {

        if (!s.panelChannelId)
          return i.editReply("未設定");

        const ch = i.guild.channels.cache.get(s.panelChannelId);
        if (!ch) return i.editReply("チャンネルなし");

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setDescription(s.panelText || "未設定");

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("panel_btn")
            .setLabel("実行")
            .setStyle(ButtonStyle.Primary)
        );

        await ch.send({ embeds: [embed], components: [row] });

        return i.editReply("送信");
      }
    }

    // =====================
    // server info
    // =====================
    if (i.commandName === 'server') {

      const g = i.guild;
      await g.members.fetch();

      const embed = new EmbedBuilder()
        .setTitle(g.name)
        .setThumbnail(g.iconURL())
        .setColor(0x2b2d31)
        .addFields(
          { name: "メンバー", value: `${g.memberCount}`, inline: true },
          { name: "ブースト", value: `${g.premiumSubscriptionCount ?? 0}`, inline: true },
          { name: "作成日", value: `<t:${Math.floor(g.createdTimestamp / 1000)}:F>`, inline: true }
        );

      return i.editReply({ embeds: [embed] });
    }

    // =====================
    // status
    // =====================
    if (i.commandName === 'status') {

      return i.editReply(
`アラート:${s.alertChannelId ? "ON" : "OFF"}
リンク:${s.linkAlertEnabled}
参加:${s.playerMonitorEnabled}`
      );
    }

  } catch (e) {
    console.error(e);
    return i.editReply("エラー");
  }
});

// =====================
// link monitor
// =====================
client.on('messageCreate', m => {

  if (m.author.bot) return;

  const s = load();

  if (!s.linkAlertEnabled) return;
  if (!s.alertChannelId) return;

  if (/(https?:\/\/)/.test(m.content)) {

    const ch = m.guild.channels.cache.get(s.alertChannelId);
    if (!ch) return;

    ch.send(`リンク検知\n${m.author.tag}\n${m.content}`);
  }
});

client.login(TOKEN);
