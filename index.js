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
   EXPRESS SERVER
========================= */
const app = express();

app.get("/", (req, res) => res.send("Bot Online"));

app.listen(process.env.PORT || 10000, "0.0.0.0", () => {
    console.log(`Web Server Running : ${process.env.PORT || 10000}`);
});

/* =========================
   DATA
========================= */
const DATA_FILE = path.join(__dirname, "data", "memberlogs.json");

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
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
        const data = loadData();

        if (!interaction.guild?.id) return;

        if (!data[interaction.guild.id]) {
            data[interaction.guild.id] = {};
        }

        /* ===== SLASH COMMAND ===== */
        if (interaction.isChatInputCommand()) {
            const cmd = client.commands.get(interaction.commandName);
            if (cmd) await cmd.execute(interaction);
            return;
        }

        /* ===== MODAL ===== */
        if (!interaction.isModalSubmit()) return;

        const gid = interaction.guild.id;

        /* ===== ANNOUNCE ===== */
        if (interaction.customId === "announce_modal") {
            const cmd = client.commands.get("announce");
            if (cmd?.modalSubmit) await cmd.modalSubmit(interaction);
            return;
        }

        /* ===== JOIN LOG ===== */
        if (interaction.customId.startsWith("joinlog_modal_")) {
            const channelId = interaction.customId.replace("joinlog_modal_", "");

            data[gid].joinChannel = channelId;
            data[gid].joinTitle = interaction.fields.getTextInputValue("join_title");
            data[gid].joinMessage = interaction.fields.getTextInputValue("join_message");

            saveData(data);

            return interaction.reply({
                content: "✅ 参加ログ設定を保存しました",
                flags: MessageFlags.Ephemeral
            });
        }

        /* ===== LEAVE LOG ===== */
        if (interaction.customId.startsWith("leavelog_modal_")) {
            const channelId = interaction.customId.replace("leavelog_modal_", "");

            data[gid].leaveChannel = channelId;
            data[gid].leaveTitle = interaction.fields.getTextInputValue("leave_title");
            data[gid].leaveMessage = interaction.fields.getTextInputValue("leave_message");

            saveData(data);

            return interaction.reply({
                content: "✅ 退出ログ設定を保存しました",
                flags: MessageFlags.Ephemeral
            });
        }

    } catch (err) {
        console.error(err);

        if (interaction.isRepliable()) {
            await interaction.reply({
                content: "エラーが発生しました",
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
});

/* =========================
   JOIN EVENT
========================= */
client.on(Events.GuildMemberAdd, async member => {
    try {
        const cmd = client.commands.get("joinmessage");
        if (cmd?.memberAdd) await cmd.memberAdd(member);

        const data = loadData();
        const config = data[member.guild.id];

        if (!config?.joinChannel) return;

        const channel = member.guild.channels.cache.get(config.joinChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor("#57F287")
            .setTitle(config.joinTitle || "メンバー参加")
            .setDescription(
                (config.joinMessage || "{user} が参加しました")
                    .replaceAll("{user}", `<@${member.id}>`)
                    .replaceAll("{username}", member.user.username)
                    .replaceAll("{server}", member.guild.name)
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (err) {
        console.error("GuildMemberAdd Error", err);
    }
});

/* =========================
   LEAVE EVENT
========================= */
client.on(Events.GuildMemberRemove, async member => {
    try {
        const cmd = client.commands.get("leavemessage");
        if (cmd?.memberRemove) await cmd.memberRemove(member);

        const data = loadData();
        const config = data[member.guild.id];

        if (!config?.leaveChannel) return;

        const channel = member.guild.channels.cache.get(config.leaveChannel);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor("#ED4245")
            .setTitle(config.leaveTitle || "メンバー退出")
            .setDescription(
                (config.leaveMessage || "{username} が退出しました")
                    .replaceAll("{user}", `<@${member.id}>`)
                    .replaceAll("{username}", member.user.username)
                    .replaceAll("{server}", member.guild.name)
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();

        await channel.send({ embeds: [embed] });

    } catch (err) {
        console.error("GuildMemberRemove Error", err);
    }
});

/* =========================
   LOGIN
========================= */
client.login(process.env.TOKEN);
