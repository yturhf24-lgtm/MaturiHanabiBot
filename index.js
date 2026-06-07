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
   DATA
========================= */
const DATA_FILE = path.join(__dirname, "data", "memberlogs.json");

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch (e) {
        console.error("DATA LOAD ERROR:", e);
        return {};
    }
}

function saveData(data) {
    try {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("DATA SAVE ERROR:", e);
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

if (!fs.existsSync(commandsPath)) {
    console.error("commandsフォルダが見つかりません");
    process.exit(1);
}

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"))) {
    const command = require(path.join(commandsPath, file));

    if (!command.data || !command.execute) {
        throw new Error(`Invalid command: ${file}`);
    }

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

/* =========================
   READY
========================= */
client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} 起動完了`);

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

    await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
    );

    console.log(`${commands.length}個のコマンド登録完了`);
});

/* =========================
   INTERACTION
========================= */
client.on(Events.InteractionCreate, async interaction => {

    try {
        if (!interaction.guild?.id) return;

        const data = loadData();
        const gid = interaction.guild.id;

        if (!data[gid]) data[gid] = {};

        /* ===== SLASH ===== */
        if (interaction.isChatInputCommand()) {
            const cmd = client.commands.get(interaction.commandName);
            if (cmd) await cmd.execute(interaction);
            return;
        }

        /* ===== MODAL ===== */
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

    } catch (err) {
        console.error("INTERACTION ERROR:", err);

        if (interaction.isRepliable()) {
            await interaction.reply({
                content: "エラーが発生しました",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
});

/* =========================
   JOIN
========================= */
client.on(Events.GuildMemberAdd, async member => {

    const data = loadData();
    const config = data[member.guild.id];

    if (!config?.joinChannel) return;

    const channel = member.guild.channels.cache.get(config.joinChannel);
    if (!channel) return;

    const text = config.joinMessage || "{user} {username} が参加しました";

    const embed = new EmbedBuilder()
        .setColor("#57F287")
        .setTitle(config.joinTitle || "参加表示")
        .setDescription(
            text
                .replaceAll("{user}", `<@${member.id}>`)
                .replaceAll("{username}", member.user.username)
        )
        .setTimestamp();

    channel.send({ embeds: [embed] });
});

/* =========================
   LEAVE
========================= */
client.on(Events.GuildMemberRemove, async member => {

    const data = loadData();
    const config = data[member.guild.id];

    if (!config?.leaveChannel) return;

    const channel = member.guild.channels.cache.get(config.leaveChannel);
    if (!channel) return;

    const text = config.leaveMessage || "{user} {username} が退出しました";

    const embed = new EmbedBuilder()
        .setColor("#ED4245")
        .setTitle(config.leaveTitle || "退出表示")
        .setDescription(
            text
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
