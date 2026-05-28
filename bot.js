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

// =====================
// Client
// =====================
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
// 共通関数
// =====================
function isAllowed(i, settings) {
  if (i.member.permissions.has(PermissionsBitField.Flags.Administrator)) return true;
  if (!settings.allowedRoles?.length) return false;
  return i.member.roles.cache.some(r => settings.allowedRoles.includes(r.id));
}

function requireChannel(i, settings) {
  if (!settings.alertChannelId) {
    i.reply({ content: "アラートチャンネル未設定", ephemeral: true });
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
      .addSubcommandGroup(g =>
        g.setName('channel')
          .setDescription('チャンネル設定')
          .addSubcommand(s =>
            s.setName('set')
              .setDescription('設定')
              .addChannelOption(o =>
                o.setName('channel').setDescription('チャンネル').setRequired(true)
              )
          )
          .addSubcommand(s =>
            s.setName('clear').setDescription('削除')
          )
      ),

    new SlashCommandBuilder()
      .setName('monitor')
      .setDescription('監視設定')
      .addSubcommandGroup(g =>
        g.setName('link')
          .setDescription('リンク監視')
          .addSubcommand(s =>
            s.setName('on').setDescription('ON')
          )
          .addSubcommand(s =>
            s.setName('off').setDescription('OFF')
          )
      )
      .addSubcommandGroup(g =>
        g.setName('player')
          .setDescription('参加監視')
          .addSubcommand(s =>
            s.setName('on').setDescription('ON')
          )
          .addSubcommand(s =>
            s.setName('off').setDescription('OFF')
          )
      ),

    new SlashCommandBuilder()
      .setName('role')
      .setDescription('ロール制御')
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
      .setDescription('説明系')
      .addSubcommand(s =>
        s.setName('channel')
          .addChannelOption(o =>
            o.setName('channel').setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('post')
      ),

    new SlashCommandBuilder()
      .setName('サーバー情報')
      .setDescription('情報表示'),

    new SlashCommandBuilder()
      .setName('設定確認')
      .setDescription('確認')

  ].map(c => c.toJSON());

  await client.application.commands.set(cmds);
});

// =====================
// コマンド処理
// =====================
client.on('interactionCreate', async i => {

  if (!i.isChatInputCommand()) return;

  settings = load();

  // =====================
  // alert channel
  // =====================
  if (i.commandName === 'alert') {

    const group = i.options.getSubcommandGroup();
    const sub = i.options.getSubcommand();

    if (group === 'channel') {

      if (!isAllowed(i, settings)) {
        return i.reply({ content: "権限なし", ephemeral: true });
      }

      if (sub === 'set') {
        const ch = i.options.getChannel('channel');
        settings.alertChannelId = ch.id;
        save(settings);

        return i.reply({ content: "設定完了", ephemeral: true });
      }

      if (sub === 'clear') {
        settings.alertChannelId = null;
        save(settings);

        return i.reply({ content: "削除完了", ephemeral: true });
      }
    }
  }

  // =====================
  // monitor
  // =====================
  if (i.commandName === 'monitor') {

    const group = i.options.getSubcommandGroup();
    const sub = i.options.getSubcommand();

    if (!requireChannel(i, settings)) return;

    if (group === 'link') {
      settings.linkAlertEnabled = (sub === 'on');
      save(settings);

      return i.reply({ content: `リンク監視:${settings.linkAlertEnabled}`, ephemeral: true });
    }

    if (group === 'player') {
      settings.playerMonitorEnabled = (sub === 'on');
      save(settings);

      return i.reply({ content: `プレイヤー監視:${settings.playerMonitorEnabled}`, ephemeral: true });
    }
  }

  // =====================
  // role
  // =====================
  if (i.commandName === 'role') {

    if (!isAllowed(i, settings)) {
      return i.reply({ content: "権限なし", ephemeral: true });
    }

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

      return i.reply({ content: "全削除完了", ephemeral: true });
    }
  }

  // =====================
  // panel
  // =====================
  if (i.commandName === 'panel') {

    const sub = i.options.getSubcommand();

    if (sub === 'channel') {

      const ch = i.options.getChannel('channel');

      settings.panelChannelId = ch.id;
      save(settings);

      return i.reply({ content: "チャンネル設定完了", ephemeral: true });
    }

    if (sub === 'post') {

      if (!settings.panelChannelId) {
        return i.reply({ content: "チャンネル未設定", ephemeral: true });
      }

      const ch = i.guild.channels.cache.get(settings.panelChannelId);
      if (!ch) return;

      const embed = new EmbedBuilder()
        .setDescription(settings.panelText || "未設定");

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
  // server info
  // =====================
  if (i.commandName === 'サーバー情報') {

    const g = i.guild;

    const members = g.memberCount;
    const users = g.members.cache.filter(m => !m.user.bot).size;
    const bots = g.members.cache.filter(m => m.user.bot).size;

    const online = g.members.cache.filter(m => m.presence?.status === 'online').size;

    const embed = new EmbedBuilder()
      .setTitle(g.name)
      .setThumbnail(g.iconURL())
      .addFields(
        { name: "メンバー", value: `総:${members}\n人:${users}\nBot:${bots}`, inline: true },
        { name: "オンライン", value: `${online}`, inline: true },
        { name: "ブースト", value: `${g.premiumSubscriptionCount}`, inline: true }
      );

    return i.reply({ embeds: [embed] });
  }

  // =====================
  // setting check
  // =====================
  if (i.commandName === '設定確認') {

    return i.reply({
      ephemeral: true,
      content:
`リンク:${settings.linkAlertEnabled}
プレイヤー:${settings.playerMonitorEnabled}
チャンネル:${settings.alertChannelId ?? "未設定"}`
    });
  }
});

// =====================
// リンク監視
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

// =====================
client.login(TOKEN);
