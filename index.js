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
    MessageFlags
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

if (!fs.existsSync(commandsPath)) {
    console.error("commandsフォルダが見つかりません");
    process.exit(1);
}

const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {

    try {

        console.log(`Loading ${file}`);

        const command = require(
            path.join(commandsPath, file)
        );

        if (!command.data) {
            throw new Error(
                "command.data がありません"
            );
        }

        if (!command.execute) {
            throw new Error(
                "command.execute がありません"
            );
        }

        client.commands.set(
            command.data.name,
            command
        );

        commands.push(
            command.data.toJSON()
        );

        console.log(`Loaded ${file}`);

    } catch (err) {

        console.error(
            `ERROR FILE: ${file}`
        );

        console.error(err);

        process.exit(1);
    }
}

client.once(Events.ClientReady, async () => {

    console.log(
        `${client.user.tag} 起動完了`
    );

    try {

        const rest = new REST({
            version: "10"
        }).setToken(
            process.env.TOKEN
        );

        await rest.put(
            Routes.applicationCommands(
                process.env.CLIENT_ID
            ),
            {
                body: commands
            }
        );

        console.log(
            `${commands.length}個のコマンド登録完了`
        );

    } catch (err) {

        console.error(err);

    }
});

client.on(
    Events.InteractionCreate,
    async interaction => {

        try {

            if (
                interaction.isChatInputCommand()
            ) {

                const command =
                    client.commands.get(
                        interaction.commandName
                    );

                if (!command) return;

                await command.execute(
                    interaction
                );

                return;
            }

        } catch (error) {

            console.error(error);

            if (
                interaction.isRepliable()
            ) {

                const payload = {
                    content:
                        "エラーが発生しました。",
                    flags:
                        MessageFlags.Ephemeral
                };

                if (
                    interaction.replied ||
                    interaction.deferred
                ) {
                    await interaction
                        .followUp(payload)
                        .catch(() => {});
                } else {
                    await interaction
                        .reply(payload)
                        .catch(() => {});
                }
            }
        }
    }
);

client.login(
    process.env.TOKEN
);
