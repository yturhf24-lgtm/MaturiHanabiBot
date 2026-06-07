require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");

const {
    Client,
    Collection,
    GatewayIntentBits,
    Events,
    REST,
    Routes,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require("discord.js");

/* =========================
   EXPRESS
========================= */
const app = express();
app.get("/", (req, res) => res.send("Bot Online"));
app.listen(process.env.PORT || 10000, () => console.log("WEB OK"));

/* =========================
   DATA
========================= */
const DATA_FILE = path.join(__dirname, "data", "memberlogs.json");

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch {
        return {};
    }
}

function saveData(data) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* =========================
   CLIENT
========================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

client.once(Events.ClientReady, () => {
    console.log(`${client.user.tag} READY`);
});

/* =========================
   INTERACTION FLOW
========================= */
client.on(Events.InteractionCreate, async interaction => {

    const data = loadData();
    const gid = interaction.guild?.id;

    if (!gid) return;
    data[gid] = data[gid] || {};

    /* =====================
       ボタン → モーダル
    ===================== */
    if (interaction.isButton()) {

        console.log("BUTTON:", interaction.customId);

        /* JOIN SETUP OPEN */
        if (interaction.customId.startsWith("open_join_modal_")) {

            const channelId = interaction.customId.replace("open_join_modal_", "");

            const modal = new ModalBuilder()
                .setCustomId("joinlog_modal_" + channelId)
                .setTitle("参加ログ設定");

            const title = new TextInputBuilder()
                .setCustomId("join_title")
                .setLabel("タイトル")
                .setStyle(TextInputStyle.Short);

            const message = new TextInputBuilder()
                .setCustomId("join_message")
                .setLabel("メッセージ")
                .setStyle(TextInputStyle.Paragraph);

            modal.addComponents(
                new ActionRowBuilder().addComponents(title),
                new ActionRowBuilder().addComponents(message)
            );

            return interaction.showModal(modal);
        }

        /* LEAVE SETUP OPEN */
        if (interaction.customId.startsWith("open_leave_modal_")) {

            const channelId = interaction.customId.replace("open_leave_modal_", "");

            const modal = new ModalBuilder()
                .setCustomId("leavelog_modal_" + channelId)
                .setTitle("退出ログ設定");

            const title = new TextInputBuilder()
                .setCustomId("leave_title")
                .setLabel("タイトル")
                .setStyle(TextInputStyle.Short);

            const message = new TextInputBuilder()
                .setCustomId("leave_message")
                .setLabel("メッセージ")
                .setStyle(TextInputStyle.Paragraph);

            modal.addComponents(
                new ActionRowBuilder().addComponents(title),
                new ActionRowBuilder().addComponents(message)
            );

            return interaction.showModal(modal);
        }
    }

    /* =====================
       MODAL SUBMIT
    ===================== */
    if (!interaction.isModalSubmit()) return;

    console.log("MODAL:", interaction.customId);

    /* JOIN SAVE */
    if (interaction.customId.startsWith("joinlog_modal_")) {

        const channelId = interaction.customId.replace("joinlog_modal_", "");

        data[gid].joinChannel = channelId;
        data[gid].joinTitle = interaction.fields.getTextInputValue("join_title");
        data[gid].joinMessage = interaction.fields.getTextInputValue("join_message");

        saveData(data);

        return interaction.reply({
            content: "✅ 参加ログ保存完了",
            flags: MessageFlags.Ephemeral
        });
    }

    /* LEAVE SAVE */
    if (interaction.customId.startsWith("leavelog_modal_")) {

        const channelId = interaction.customId.replace("leavelog_modal_", "");

        data[gid].leaveChannel = channelId;
        data[gid].leaveTitle = interaction.fields.getTextInputValue("leave_title");
        data[gid].leaveMessage = interaction.fields.getTextInputValue("leave_message");

        saveData(data);

        return interaction.reply({
            content: "✅ 退出ログ保存完了",
            flags: MessageFlags.Ephemeral
        });
    }
});

/* =========================
   JOIN EVENT
========================= */
client.on(Events.GuildMemberAdd, async member => {

    const data = loadData();
    const config = data[member.guild.id];

    if (!config?.joinChannel) return;

    const channel = member.guild.channels.cache.get(config.joinChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle(config.joinTitle || "参加表示")
        .setDescription(
            (config.joinMessage || "{user} {username} が参加しました")
                .replaceAll("{user}", `<@${member.id}>`)
                .replaceAll("{username}", member.user.username)
        )
        .setTimestamp();

    channel.send({ embeds: [embed] });
});

/* =========================
   LEAVE EVENT
========================= */
client.on(Events.GuildMemberRemove, async member => {

    const data = loadData();
    const config = data[member.guild.id];

    if (!config?.leaveChannel) return;

    const channel = member.guild.channels.cache.get(config.leaveChannel);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle(config.leaveTitle || "退出表示")
        .setDescription(
            (config.leaveMessage || "{user} {username} が退出しました")
                .replaceAll("{user}", `<@${member.id}>`)
                .replaceAll("{username}", member.user.username)
        )
        .setTimestamp();

    channel.send({ embeds: [embed] });
});

/* =========================
   LOGIN
========================= */
client.login(process.env.TOKEN);
