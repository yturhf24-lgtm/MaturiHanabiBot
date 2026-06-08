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
   LOG
========================= */
console.log("BOOT START:", process.version);

/* =========================
   EXPRESS
========================= */
const app = express();

app.get("/", (req, res) => {
    res.send("Bot Online");
});

app.listen(process.env.PORT || 10000, "0.0.0.0", () => {
    console.log("WEB SERVER OK");
});

/* =========================
   DATA FILE
========================= */
const DATA_FILE = path.join(__dirname, "data", "memberlogs.json");

function loadData() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    } catch (e) {
        console.log("DATA RESET (corrupted file)");
        return {};
    }
}

function saveData(data) {
    try {
        fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("SAVE ERROR", e);
    }
}

/* =========================
   CLIENT
========================= */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();

/* =========================
   COMMAND LOAD
========================= */
const commands = [];
const commandsPath = path.join(__dirname, "commands");

if (!fs.existsSync(commandsPath)) {
    console.error("commandsフォルダがありません");
    process.exit(1);
}

for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"))) {
    const command = require(path.join(commandsPath, file));

    if (!command.data || !command.execute) {
        console.error("INVALID COMMAND:", file);
        continue;
    }

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

/* =========================
   READY
========================= */
client.once(Events.ClientReady, async () => {
    console.log("READY CHECK:", client.user.tag);

    try {
        const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log("SLASH REGISTER OK");
    } catch (e) {
        console.error("SLASH ERROR", e);
    }
});

/* =========================
   INTERACTION
========================= */
client.on(Events.InteractionCreate, async interaction => {
    try {
        if (!interaction.guild) return;

        const data = loadData();
        const gid = interaction.guild.id;

        if (!data[gid]) data[gid] = {};

        /* SLASH */
        if (interaction.isChatInputCommand()) {
            const cmd = client.commands.get(interaction.commandName);
            if (cmd) await cmd.execute(interaction);
            return;
        }

        /* MODAL */
        if (!interaction.isModalSubmit()) return;

        /* JOIN LOG */
        if (interaction.customId.startsWith("joinlog_modal_")) {
            const channelId = interaction.customId.replace("joinlog_modal_", "");

            data[gid].joinChannel = channelId;
            data[gid].joinTitle = interaction.fields.getTextInputValue("join_title");
            data[gid].joinMessage = interaction.fields.getTextInputValue("join_message");

            saveData(data);

            return interaction.reply({
                content: "✅ 参加ログ保存OK",
                flags: MessageFlags.Ephemeral
            });
        }

        /* LEAVE LOG */
        if (interaction.customId.startsWith("leavelog_modal_")) {
            const channelId = interaction.customId.replace("leavelog_modal_", "");

            data[gid].leaveChannel = channelId;
            data[gid].leaveTitle = interaction.fields.getTextInputValue("leave_title");
            data[gid].leaveMessage = interaction.fields.getTextInputValue("leave_message");

            saveData(data);

            return interaction.reply({
                content: "✅ 退出ログ保存OK",
                flags: MessageFlags.Ephemeral
            });
        }

    } catch (err) {
        console.error("INTERACTION ERROR", err);

        if (interaction.isRepliable()) {
            try {
                await interaction.reply({
                    content: "エラーが発生しました",
                    flags: MessageFlags.Ephemeral
                });
            } catch {}
        }
    }
});

/* =========================
   JOIN
========================= */
client.on(Events.GuildMemberAdd, async member => {
    try {
        const data = loadData();
        const config = data[member.guild.id];

        if (!config?.joinChannel) return;

        const channel = member.guild.channels.cache.get(config.joinChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor("#57F287")
            .setTitle(config.joinTitle || "メンバー参加")
            .setDescription(
                (config.joinMessage || "{user}")
                    .replaceAll("{user}", `<@${member.id}>`)
                    .replaceAll("{username}", member.user.username)
                    .replaceAll("{server}", member.guild.name)
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (e) {
        console.error("JOIN ERROR", e);
    }
});

/* =========================
   LEAVE
========================= */
client.on(Events.GuildMemberRemove, async member => {
    try {
        const data = loadData();
        const config = data[member.guild.id];

        if (!config?.leaveChannel) return;

        const channel = member.guild.channels.cache.get(config.leaveChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor("#ED4245")
            .setTitle(config.leaveTitle || "メンバー退出")
            .setDescription(
                (config.leaveMessage || "{user}")
                    .replaceAll("{user}", `<@${member.id}>`)
                    .replaceAll("{username}", member.user.username)
                    .replaceAll("{server}", member.guild.name)
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (e) {
        console.error("LEAVE ERROR", e);
    }
});

/* =========================
   LOGIN
========================= */
client.login(process.env.TOKEN);
