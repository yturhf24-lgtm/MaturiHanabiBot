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
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} = require("discord.js");

const app = express();

app.get("/", (req, res) => {
    res.send("Bot Online");
});

app.listen(process.env.PORT || 10000, "0.0.0.0", () => {
    console.log(`Web Server Running : ${process.env.PORT || 10000}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();

const commands = [];
const commandsPath = path.join(__dirname, "commands");

const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

client.once(Events.ClientReady, async () => {
    console.log(`${client.user.tag} 起動完了`);

    try {
        const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );

        console.log(`${commands.length}個のコマンド登録完了`);
    } catch (err) {
        console.error(err);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    try {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === "button_create") {
                const buttonName = interaction.fields.getTextInputValue("button_name");
                const description = interaction.fields.getTextInputValue("button_desc");
                const message = interaction.fields.getTextInputValue("button_message");

                const embed = new EmbedBuilder()
                    .setColor("#5865F2")
                    .setTitle(buttonName)
                    .setDescription(description);

                const button = new ButtonBuilder()
                    .setCustomId(`btn_${Buffer.from(message).toString("base64")}`)
                    .setLabel(buttonName)
                    .setStyle(ButtonStyle.Primary);

                const row = new ActionRowBuilder().addComponents(button);

                await interaction.reply({
                    content: "ボタン作成完了",
                    ephemeral: true
                });

                await interaction.channel.send({
                    embeds: [embed],
                    components: [row]
                });

                return;
            }
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith("btn_")) {
                const msg = Buffer.from(
                    interaction.customId.replace("btn_", ""),
                    "base64"
                ).toString();

                await interaction.reply({
                    content: msg,
                    ephemeral: true
                });

                return;
            }
        }
    } catch (error) {
        console.error(error);

        if (interaction.isRepliable()) {
            await interaction.reply({
                content: "エラーが発生しました。",
                ephemeral: true
            }).catch(() => {});
        }
    }
});

client.login(process.env.TOKEN);
