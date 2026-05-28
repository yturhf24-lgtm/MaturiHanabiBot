const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionsBitField,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
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

function isAllowed(i, s) {
  if (i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (!s.allowedRoles?.length) return false;
  return i.member.roles.cache.some(r => s.allowedRoles.includes(r.id));
}

function requireAlert(i, s) {
  if (!s.alertChannelId) {
    i.editReply("アラートチャンネル未設定");
    return false;
  }
  return true;
}

// =====================
// 起動
// =====================
client.once('ready', async () => {
  console.log(`${client.user.tag} Ready`);

  const cmds = [

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

    new SlashCommandBuilder()
      .setName('link')
      .setDescription('リンク監視')
      .addSubcommand(s => s.setName('on'))
      .addSubcommand(s => s.setName('off')),

    new SlashCommandBuilder()
      .setName('player')
      .setDescription('参加監視')
      .addSubcommand(s => s.setName('on'))
      .addSubcommand(s => s.setName('off')),

    new SlashCommandBuilder()
      .setName('role')
      .setDescription('ロール管理')
      .addSubcommand(s =>
        s.setName('add')
          .addRoleOption(o =>
            o.setName('role').setDescription('ロール').setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('clear')
      ),

    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('パネル')
      .addSubcommand(s =>
        s.setName('setchannel')
          .addChannelOption(o =>
            o.setName('channel').setDescription('チャンネル').setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('post')
      ),

    new SlashCommandBuilder()
      .setName('server')
      .setDescription('サーバー情報'),

    new SlashCommandBuilder()
      .setName('status')
      .setDescription('状態確認')

  ].map(c => c.toJSON());

  await client.application.commands.set(cmds);
});

// =====================
// interaction
// =====================
client.on('interactionCreate', async i => {

  if (!i.isChatInputCommand()) return;

  // 💥 応答遅延（必須）
  await i.deferReply({ ephemeral: true });

  let s;

  try {
    s = load();
  } catch (e) {
    return i.editReply("設定読み込み失敗");
  }

  try {

    // =====================
    // alert
    // =====================
    if (i.commandName === 'alert') {

      if (!isAllowed(i, s))
        return i.editReply("権限なし");

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

        return i.editReply("無効化");
      }
    }

    // =====================
    // link
    // =====================
    if (i.commandName === 'link') {

      if (!isAllowed(i, s))
        return i.editReply("権限なし");

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

      if (!isAllowed(i, s))
        return i.editReply("権限なし");

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

      if (!isAllowed(i, s))
        return i.editReply("権限なし");

      const sub = i.options.getSubcommand();

      if (sub === 'add') {
        const role = i.options.getRole('role');

        if (!s.allowedRoles.includes(role.id)) {
          s.allowedRoles.push(role.id);
          save(s);
        }

        return i.editReply("追加完了");
      }

      if (sub === 'clear') {
        s.allowedRoles = [];
        save(s);

        return i.editReply("削除完了");
      }
    }

    // =====================
    // panel
    // =====================
    if (i.commandName === 'panel') {

      if (!isAllowed(i, s))
        return i.editReply("権限なし");

      const sub = i.options.getSubcommand();

      if (sub === 'setchannel') {
        const ch = i.options.getChannel('channel');

        s.panelChannelId = ch.id;
        save(s);

        return i.editReply("設定完了");
      }

      if (sub === 'post') {

        if (!s.panelChannelId)
          return i.editReply("チャンネル未設定");

        const ch = i.guild.channels.cache.get(s.panelChannelId);
        if (!ch) return i.editReply("チャンネル取得失敗");

        const embed = new EmbedBuilder()
          .setDescription(safeStr(s.panelText));

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('panel_button')
            .setLabel('実行')
            .setStyle(ButtonStyle.Primary)
        );

        await ch.send({ embeds: [embed], components: [row] });

        return i.editReply("送信完了");
      }
    }

    // =====================
    // server
    // =====================
    if (i.commandName === 'server') {

      const g = i.guild;

      return i.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle(g.name)
            .setThumbnail(g.iconURL())
            .addFields(
              { name: "人数", value: `${g.memberCount}`, inline: true },
              { name: "ブースト", value: `${g.premiumSubscriptionCount ?? 0}`, inline: true }
            )
        ]
      });
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

  } catch (err) {
    console.error(err);
    return i.editReply("エラーが発生しました");
  }
});

// =====================
// link detect
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
