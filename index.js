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

app.listen(process.env.PORT || 10000, "0.0.0.0", () => {
    console.log("WEB OK");
});

/* =========================
   DATA SAFE
========================= */
const DATA_FILE = path.join(__dirname, "data", "memberlogs.json");

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        console.log("LOAD ERROR:", e);
        return {};
    }
}

function saveData(data) {
    try {
        if (!data || Object.keys(data).length === 0) return;

        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

        console.log("💾 SAVED");
    } catch (e) {
        console.log("SAVE ERROR:", e);
    }
}

/* キャッシュ */
let cache = loadData();

/* =========================
   CLIENT
========================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();

/* =========================
   READY
========================= */
client.once(Events.ClientReady, () => {
    console.log(`${client.user.tag} READY`);
});

/* =========================
   INTERACTION FIX（ここ重要）
========================= */
client.on(Events.InteractionCreate, async interaction => {
    try {

        // 🔥 まず全部ログ（原因特定用）
        console.log("INTERACTION TYPE:", {
            command: interaction.isChatInputCommand?.(),
            modal: interaction.isModalSubmit?.(),
            customId: interaction.customId ?? null
        });

        if (!interaction.guild) return;

        const gid = interaction.guild.id;
        cache[gid] = cache[gid] || {};

        /* =====================
           SLASH
        ===================== */
        if (interaction.isChatInputCommand()) return;

        /* =====================
           MODAL ONLY
        ===================== */
        if (!interaction.isModalSubmit()) return;

        // 🔥 ここで落ちるなら modal来てない
        if (!interaction.customId) {
            console.log("❌ customId undefined (modal not received)");
            return;
        }

        console.log("MODAL RECEIVED:", interaction.customId);

        /* =====================
           JOIN LOG
        ===================== */
        if (interaction.customId.startsWith("joinlog_modal_")) {

            const channelId = interaction.customId.replace("joinlog_modal_", "");

            cache[gid].joinChannel = channelId;
            cache[gid].joinTitle = interaction.fields.getTextInputValue("join_title");
            cache[gid].joinMessage = interaction.fields.getTextInputValue("join_message");

            saveData(cache);

            return interaction.reply({
                content: "✅ 参加ログ保存OK",
                flags: MessageFlags.Ephemeral
            });
        }

        /* =====================
           LEAVE LOG
        ===================== */
        if (interaction.customId.startsWith("leavelog_modal_")) {

            const channelId = interaction.customId.replace("leavelog_modal_", "");

            cache[gid].leaveChannel = channelId;
            cache[gid].leaveTitle = interaction.fields.getTextInputValue("leave_title");
            cache[gid].leaveMessage = interaction.fields.getTextInputValue("leave_message");

            saveData(cache);

            return interaction.reply({
                content: "✅ 退出ログ保存OK",
                flags: MessageFlags.Ephemeral
            });
        }

    } catch (err) {
        console.log("INTERACTION ERROR:", err);
    }
});

/* =========================
   JOIN EVENT
========================= */
client.on(Events.GuildMemberAdd, async member => {
    try {
        const config = cache[member.guild.id];
        if (!config?.joinChannel) return;

        const channel = member.guild.channels.cache.get(config.joinChannel);
        if (!channel) return;

        const text = config.joinMessage ?? "{user} {username} が参加しました";

        const embed = new EmbedBuilder()
            .setColor("#57F287")
            .setTitle(config.joinTitle || "参加表示")
            .setDescription(
                text
                    .replaceAll("{user}", `<@${member.id}>`)
                    .replaceAll("{username}", member.user.username)
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (err) {
        console.log("JOIN ERROR:", err);
    }
});

/* =========================
   LEAVE EVENT
========================= */
client.on(Events.GuildMemberRemove, async member => {
    try {
        const config = cache[member.guild.id];
        if (!config?.leaveChannel) return;

        const channel = member.guild.channels.cache.get(config.leaveChannel);
        if (!channel) return;

        const text = config.leaveMessage ?? "{user} {username} が退出しました";

        const embed = new EmbedBuilder()
            .setColor("#ED4245")
            .setTitle(config.leaveTitle || "退出表示")
            .setDescription(
                text
                    .replaceAll("{user}", `<@${member.id}>`)
                    .replaceAll("{username}", member.user.username)
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (err) {
        console.log("LEAVE ERROR:", err);
    }
});

/* =========================
   LOGIN
========================= */
client.login(process.env.TOKEN);
