const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'guildConfig.json');

// =====================
// グローバル管理者
// =====================
const GLOBAL_ADMINS = ["1266013271518089258"];

// =====================
// メモリ
// =====================
const warnMap = new Map();

// =====================
// DB
// =====================
function loadDB() {
  if (!fs.existsSync(DB_PATH)) return {};
  return JSON.parse(fs.readFileSync(DB_PATH));
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function getGuild(db, id) {
  if (!db[id]) {
    db[id] = {
      roles: [],
      logChannel: null,
      alertChannel: null,
      panelChannel: null,
      panelTargetChannel: null,
      realtimeLog: false,
      monitor: {
        link: false,
        join: false
      }
    };
  }
  return db[id];
}

// =====================
// 言語
// =====================
const LANG = {
  server: { ja: "サーバー情報", en: "Server Info" },
  panel: { ja: "パネル", en: "Panel" },
  send: { ja: "送信", en: "Send" },
};

// =====================
// 時間
// =====================
function getTime() {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日${d.toLocaleString('ja-JP',{weekday:'long'})} ${d.toTimeString().split(' ')[0]}`;
}

const isAdmin = (id) => GLOBAL_ADMINS.includes(id);

// =====================
// リンク判定
// =====================
function hasLink(text) {
  return /(https?:\/\/|discord\.gg)/i.test(text);
}

// =====================
// ログ
// =====================
function sendLog(ch, embed) {
  if (!ch) return;
  ch.send({ embeds: [embed] }).catch(()=>{});
}

// =====================
// リンク警告（5秒削除）
// =====================
async function sendWarn(channel) {

  const embed = new EmbedBuilder()
    .setTitle("🚨 リンク検知")
    .setDescription("リンクは監視されています。危険なリンクはBAN対象です。")
    .setColor(0xff0000)
    .setFooter({ text: getTime() });

  const msg = await channel.send({ embeds: [embed] });

  setTimeout(() => msg.delete().catch(()=>{}), 5000);

  return msg;
}

// =====================
// COMMANDS
// =====================
async function registerCommands(client) {

  const commands = [

    new SlashCommandBuilder()
      .setName('server')
      .setDescription('サーバー情報')
      .addStringOption(o =>
        o.setName('lang')
          .addChoices(
            { name:'日本語', value:'ja' },
            { name:'English', value:'en' }
          )
      ),

    new SlashCommandBuilder()
      .setName('monitor')
      .setDescription('監視ON/OFF')
      .addStringOption(o =>
        o.setName('type')
          .addChoices(
            { name:'リンク', value:'link' },
            { name:'参加', value:'join' }
          )
          .setRequired(true)
      )
      .addStringOption(o =>
        o.setName('mode')
          .addChoices(
            { name:'ON', value:'on' },
            { name:'OFF', value:'off' }
          )
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('alert')
      .setDescription('アラート設定')
      .addChannelOption(o =>
        o.setName('channel').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('realtimelog')
      .setDescription('リアルタイムログON')
      .addChannelOption(o =>
        o.setName('channel').setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('パネル作成')
      .addChannelOption(o =>
        o.setName('channel').setRequired(true)
      )

  ].map(c => c.toJSON());

  await client.application.commands.set(commands);
}

// =====================
// SERVER EMBED
// =====================
function serverEmbed(guild, lang='ja') {

  return new EmbedBuilder()
    .setTitle(`📊 ${LANG.server[lang]} - ${guild.name}`)
    .setColor(0x00b0f4)
    .addFields(
      { name:"👥 Members", value:`${guild.memberCount}` },
      { name:"📅 Created", value: guild.createdAt.toLocaleString('ja-JP') }
    );
}

// =====================
// MESSAGE EVENT
// =====================
async function onMessage(message, client) {

  if (message.author.bot) return;

  const db = loadDB();
  const data = getGuild(db, message.guild.id);

  // =====================
  // リアルタイムログ
  // =====================
  if (data.realtimeLog && data.logChannel) {

    const ch = message.guild.channels.cache.get(data.logChannel);

    const embed = new EmbedBuilder()
      .setTitle("🟡 Message Log")
      .addFields(
        { name:"User", value:`<@${message.author.id}>` },
        { name:"Channel", value:`<#${message.channel.id}>` },
        { name:"Content", value:message.content || "none" },
        { name:"Time", value:getTime() }
      );

    sendLog(ch, embed);
  }

  // =====================
  // LINK MONITOR
  // =====================
  if (data.monitor.link && hasLink(message.content)) {

    await message.delete().catch(()=>{});

    const warnMsg = await sendWarn(message.channel);
    warnMap.set(message.id, warnMsg.id);

    const embed = new EmbedBuilder()
      .setTitle("🚨 LINK ALERT")
      .addFields(
        { name:"User", value:`<@${message.author.id}>` },
        { name:"Channel", value:`<#${message.channel.id}>` },
        { name:"Time", value:getTime() }
      )
      .setColor(0xff0000);

    const alert = message.guild.channels.cache.get(data.alertChannel);
    const log = message.guild.channels.cache.get(data.logChannel);

    sendLog(alert, embed);
    sendLog(log, embed);
  }
}

// =====================
// DELETE SYNC
// =====================
function registerDelete(client) {

  client.on('messageDelete', async (msg) => {

    const warnId = warnMap.get(msg.id);
    if (!warnId) return;

    try {
      const m = await msg.channel.messages.fetch(warnId);
      if (m) await m.delete().catch(()=>{});
    } catch {}

    warnMap.delete(msg.id);
  });
}

// =====================
// JOIN EVENT
// =====================
function registerJoin(client) {

  client.on('guildMemberAdd', member => {

    const db = loadDB();
    const data = getGuild(db, member.guild.id);

    if (!data.monitor.join) return;

    const embed = new EmbedBuilder()
      .setTitle("👤 JOIN ALERT")
      .addFields(
        { name:"User", value:`<@${member.id}>` },
        { name:"Name", value:member.user.username },
        { name:"Time", value:getTime() }
      );

    const alert = member.guild.channels.cache.get(data.alertChannel);
    const log = member.guild.channels.cache.get(data.logChannel);

    sendLog(alert, embed);
    sendLog(log, embed);
  });
}

// =====================
// INTERACTION
// =====================
async function handleInteraction(interaction) {

  if (!interaction.isChatInputCommand()) return;

  const db = loadDB();
  const guild = interaction.guild;
  const data = getGuild(db, guild.id);

  const lang = interaction.options.getString('lang') || 'ja';

  if (!isAdmin(interaction.user.id)) {
    return interaction.reply({ content:"❌ No permission", ephemeral:true });
  }

  // =====================
  // SERVER
  // =====================
  if (interaction.commandName === 'server') {
    return interaction.reply({ embeds:[serverEmbed(guild, lang)] });
  }

  // =====================
  // MONITOR
  // =====================
  if (interaction.commandName === 'monitor') {

    const type = interaction.options.getString('type');
    const mode = interaction.options.getString('mode');

    data.monitor[type] = mode === 'on';
    saveDB(db);

    return interaction.reply(`📡 ${type} => ${mode}`);
  }

  // =====================
  // ALERT
  // =====================
  if (interaction.commandName === 'alert') {

    const ch = interaction.options.getChannel('channel');
    data.alertChannel = ch.id;

    saveDB(db);

    return interaction.reply(`🚨 alert set`);
  }

  // =====================
  // REALTIME LOG
  // =====================
  if (interaction.commandName === 'realtimelog') {

    const ch = interaction.options.getChannel('channel');

    data.realtimeLog = true;
    data.logChannel = ch.id;

    saveDB(db);

    return interaction.reply(`📡 realtime log ON`);
  }

  // =====================
  // PANEL CREATE
  // =====================
  if (interaction.commandName === 'panel') {

    const ch = interaction.options.getChannel('channel');

    data.panelChannel = ch.id;
    data.panelTargetChannel = ch.id;

    saveDB(db);

    const embed = new EmbedBuilder()
      .setTitle("📌 Panel")
      .setDescription("ボタンを押して送信");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("panel_open")
        .setLabel("送信")
        .setStyle(ButtonStyle.Primary)
    );

    await ch.send({ embeds:[embed], components:[row] });

    return interaction.reply("📌 panel created");
  }
}

// =====================
// PANEL SYSTEM
// =====================
function registerPanel(client) {

  client.on("interactionCreate", async (i) => {

    if (i.isButton() && i.customId === "panel_open") {

      const modal = new ModalBuilder()
        .setCustomId("panel_modal")
        .setTitle("送信");

      const input = new TextInputBuilder()
        .setCustomId("text")
        .setLabel("内容")
        .setStyle(TextInputStyle.Paragraph);

      modal.addComponents(new ActionRowBuilder().addComponents(input));

      await i.showModal(modal);
    }

    if (i.isModalSubmit() && i.customId === "panel_modal") {

      const text = i.fields.getTextInputValue("text");

      const embed = new EmbedBuilder()
        .setTitle("📨 Panel Send")
        .setDescription(text);

      await i.channel.send({ embeds:[embed] });

      return i.reply({ content:"✅ sent", ephemeral:true });
    }
  });
}

module.exports = {
  registerCommands,
  handleInteraction,
  onMessage,
  registerDelete,
  registerJoin,
  registerPanel
};
