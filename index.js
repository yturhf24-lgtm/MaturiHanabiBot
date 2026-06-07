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
    EmbedBuilder
} = require("discord.js");

/* =========================
   EXPRESS
========================= */
const app = express();
app.get("/", (req, res) => res.send("Bot Online"));
app.listen(process.env.PORT || 10000, () => console.log("WEB OK"));

/* =========================
   DATA SAFE
========================= */
const DATA_FILE = path.join(__dirname, "data", "memberlogs.json");

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        if (!raw) return {};
        return JSON.parse(raw);
    } catch (e) {
        console.error("LOAD ERROR:", e);
        return {};
    }
}

function saveData(data) {
    try {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("SAVE ERROR:", e);
    }
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

/* =========================
   READY
========================= */
client.once(Events.ClientReady, () => {
    console.log(`${client.user.tag} READY`);
});

/* =========================
   INTERACTION SAVE ONLY
========================= */
client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.guild) return;

    const data = loadData();
    const gid = interaction.guild.id;

    data[gid] = data[gid] || {};

    if (!interaction.isModalSubmit()) return;

    /* JOIN */
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

    /* LEAVE */
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

    const message = (config.joinMessage || "{user} {username} が参加しました");

    const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle(config.joinTitle || "参加表示")
        .setDescription(
            message
                .replaceAll("{user}", `<@${member.id}>`)
                .replaceAll("{username}", member.user.username ?? "unknown")
        )
        .setTimestamp();

    await channel.send({ embeds: [embed] });
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

    const message = (config.leaveMessage || "{user} {username} が退出しました");

    const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle(config.leaveTitle || "退出表示")
        .setDescription(
            message
                .replaceAll("{user}", `<@${member.id}>`)
                .replaceAll("{username}", member.user.username ?? "unknown")
        )
        .setTimestamp();

    await channel.send({ embeds: [embed] });
});

/* =========================
   LOGIN
========================= */
client.login(process.env.TOKEN);
