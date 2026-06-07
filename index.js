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
   WEB SERVER
========================= */
const app = express();
app.get("/", (_, res) => res.send("Bot Online"));

app.listen(process.env.PORT || 10000, () => {
    console.log("WEB SERVER OK");
});

/* =========================
   DATA SYSTEM（サーバー別）
========================= */
const DATA_FILE = path.join(__dirname, "data", "memberlogs.json");

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        const raw = fs.readFileSync(DATA_FILE, "utf8");
        return raw ? JSON.parse(raw) : {};
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

client.commands = new Collection();

/* =========================
   COMMAND LOADER
========================= */
const commands = [];
const commandsPath = path.join(__dirname, "commands");

if (fs.existsSync(commandsPath)) {
    for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"))) {
        const cmd = require(path.join(commandsPath, file));

        if (cmd?.data && cmd?.execute) {
            client.commands.set(cmd.data.name, cmd);
            commands.push(cmd.data.toJSON());
        }
    }
}

/* =========================
   READY
========================= */
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} READY`);

    try {
        const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log("SLASH REGISTER OK");
    } catch (e) {
        console.error("SLASH ERROR:", e);
    }
});

/* =========================
   INTERACTION
========================= */
client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.guild) return;

    const gid = interaction.guild.id;
    const data = loadData();
    data[gid] = data[gid] || {};

    /* ===== SLASH ===== */
    if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (cmd) await cmd.execute(interaction);
        return;
    }

    /* ===== MODAL ONLY ===== */
    if (!interaction.isModalSubmit()) return;

    try {

        /* ================= JOIN LOG ================= */
        if (interaction.customId.startsWith("joinlog_modal_")) {

            const channelId = interaction.customId.split("_").pop();

            data[gid].joinChannel = channelId;
            data[gid].joinTitle =
                interaction.fields.getTextInputValue("join_title") || "参加ログ";
            data[gid].joinMessage =
                interaction.fields.getTextInputValue("join_message") ||
                "{user} {username} が参加しました";

            saveData(data);

            return interaction.reply({
                content: "✅ 参加ログ保存完了",
                flags: MessageFlags.Ephemeral
            });
        }

        /* ================= LEAVE LOG ================= */
        if (interaction.customId.startsWith("leavelog_modal_")) {

            const channelId = interaction.customId.split("_").pop();

            data[gid].leaveChannel = channelId;
            data[gid].leaveTitle =
                interaction.fields.getTextInputValue("leave_title") || "退出ログ";
            data[gid].leaveMessage =
                interaction.fields.getTextInputValue("leave_message") ||
                "{user} {username} が退出しました";

            saveData(data);

            return interaction.reply({
                content: "✅ 退出ログ保存完了",
                flags: MessageFlags.Ephemeral
            });
        }

    } catch (e) {
        console.error("MODAL ERROR:", e);
    }
});

/* =========================
   JOIN EVENT
========================= */
client.on(Events.GuildMemberAdd, async member => {

    try {
        const data = loadData();
        const config = data[member.guild.id];

        if (!config?.joinChannel) return;

        const channel = member.guild.channels.cache.get(config.joinChannel);
        if (!channel) return;

        const text = config.joinMessage || "{user} {username} が参加しました";

        const embed = new EmbedBuilder()
            .setColor("#57F287")
            .setTitle(config.joinTitle || "参加ログ")
            .setDescription(
                text
                    .replaceAll("{user}", `<@${member.id}>`)
                    .replaceAll("{username}", member.user?.username || "unknown")
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });

        console.log("JOIN LOG OK");

    } catch (e) {
        console.error("JOIN ERROR:", e);
    }
});

/* =========================
   LEAVE EVENT
========================= */
client.on(Events.GuildMemberRemove, async member => {

    try {
        const data = loadData();
        const config = data[member.guild.id];

        if (!config?.leaveChannel) return;

        const channel = member.guild.channels.cache.get(config.leaveChannel);
        if (!channel) return;

        const text = config.leaveMessage || "{user} {username} が退出しました";

        const embed = new EmbedBuilder()
            .setColor("#ED4245")
            .setTitle(config.leaveTitle || "退出ログ")
            .setDescription(
                text
                    .replaceAll("{user}", `<@${member.id}>`)
                    .replaceAll("{username}", member.user?.username || "unknown")
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });

        console.log("LEAVE LOG OK");

    } catch (e) {
        console.error("LEAVE ERROR:", e);
    }
});

/* =========================
   LOGIN
========================= */
client.login(process.env.TOKEN);
