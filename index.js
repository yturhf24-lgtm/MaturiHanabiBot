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

const app = express();

app.get("/", (req, res) => {
    res.send("Bot Online");
});

app.listen(process.env.PORT || 10000, "0.0.0.0", () => {
    console.log(
        `Web Server Running : ${
            process.env.PORT || 10000
        }`
    );
});

const DATA_FILE = path.join(
    __dirname,
    "data",
    "memberlogs.json"
);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.commands = new Collection();

const commands = [];
const commandsPath = path.join(
    __dirname,
    "commands"
);

if (!fs.existsSync(commandsPath)) {

    console.error(
        "commandsフォルダが見つかりません"
    );

    process.exit(1);
}

const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file =>
        file.endsWith(".js")
    );

for (const file of commandFiles) {

    try {

        console.log(
            `Loading ${file}`
        );

        const command = require(
            path.join(
                commandsPath,
                file
            )
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

        console.log(
            `Loaded ${file}`
        );

    } catch (err) {

        console.error(
            `ERROR FILE: ${file}`
        );

        console.error(err);

        process.exit(1);
    }
}

client.once(
    Events.ClientReady,
    async () => {

        console.log(
            `${client.user.tag} 起動完了`
        );

        try {

            const rest =
                new REST({
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
    }
);

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

            if (
                interaction.isModalSubmit()
            ) {

                let data = {};

                if (
                    fs.existsSync(
                        DATA_FILE
                    )
                ) {

                    data = JSON.parse(
                        fs.readFileSync(
                            DATA_FILE,
                            "utf8"
                        )
                    );
                }

                if (
                    !data[
                        interaction.guild.id
                    ]
                ) {

                    data[
                        interaction.guild.id
                    ] = {};
                }

                if (
                    interaction.customId ===
                    "announce_modal"
                ) {

                    const command =
                        client.commands.get(
                            "announce"
                        );

                    if (
                        command &&
                        command.modalSubmit
                    ) {

                        await command.modalSubmit(
                            interaction
                        );
                    }

                    return;
                }

                if (
                    interaction.customId ===
                    "joinmessage_modal"
                ) {

                    const command =
                        client.commands.get(
                            "joinmessage"
                        );

                    if (
                        command &&
                        command.modalSubmit
                    ) {

                        await command.modalSubmit(
                            interaction
                        );
                    }

                    return;
                }

                if (
                    interaction.customId ===
                    "leavemessage_modal"
                ) {

                    const command =
                        client.commands.get(
                            "leavemessage"
                        );

                    if (
                        command &&
                        command.modalSubmit
                    ) {

                        await command.modalSubmit(
                            interaction
                        );
                    }

                    return;
                }

                if (
                    interaction.customId ===
                    "joinlog_modal"
                ) {

                    const channel =
                        interaction.fields.getTextInputValue(
                            "join_channel"
                        );

                    const title =
                        interaction.fields.getTextInputValue(
                            "join_title"
                        );

                    const message =
                        interaction.fields.getTextInputValue(
                            "join_message"
                        );

                    data[
                        interaction.guild.id
                    ].joinChannel =
                        channel.toLowerCase() ===
                        "off"
                            ? null
                            : channel;

                    data[
                        interaction.guild.id
                    ].joinTitle =
                        title;

                    data[
                        interaction.guild.id
                    ].joinMessage =
                        message;

                    fs.mkdirSync(
                        path.dirname(
                            DATA_FILE
                        ),
                        {
                            recursive: true
                        }
                    );

                    fs.writeFileSync(
                        DATA_FILE,
                        JSON.stringify(
                            data,
                            null,
                            2
                        )
                    );

                    return interaction.reply({
                        content:
                            "✅ 参加ログ設定を保存しました",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }

                if (
                    interaction.customId ===
                    "leavelog_modal"
                ) {

                    const channel =
                        interaction.fields.getTextInputValue(
                            "leave_channel"
                        );

                    const title =
                        interaction.fields.getTextInputValue(
                            "leave_title"
                        );

                    const message =
                        interaction.fields.getTextInputValue(
                            "leave_message"
                        );

                    data[
                        interaction.guild.id
                    ].leaveChannel =
                        channel.toLowerCase() ===
                        "off"
                            ? null
                            : channel;

                    data[
                        interaction.guild.id
                    ].leaveTitle =
                        title;

                    data[
                        interaction.guild.id
                    ].leaveMessage =
                        message;

                    fs.mkdirSync(
                        path.dirname(
                            DATA_FILE
                        ),
                        {
                            recursive: true
                        }
                    );

                    fs.writeFileSync(
                        DATA_FILE,
                        JSON.stringify(
                            data,
                            null,
                            2
                        )
                    );

                    return interaction.reply({
                        content:
                            "✅ 退出ログ設定を保存しました",
                        flags:
                            MessageFlags.Ephemeral
                    });
                }
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
                        .followUp(
                            payload
                        )
                        .catch(
                            () => {}
                        );

                } else {

                    await interaction
                        .reply(
                            payload
                        )
                        .catch(
                            () => {}
                        );
                }
            }
        }
    }
);

client.on(
    Events.GuildMemberAdd,
    async member => {

        try {

            const command =
                client.commands.get(
                    "joinmessage"
                );

            if (
                command &&
                command.memberAdd
            ) {

                await command.memberAdd(
                    member
                );
            }

        } catch (err) {

            console.error(
                "GuildMemberAdd Error",
                err
            );
        }
    }
);

client.on(
    Events.GuildMemberRemove,
    async member => {

        try {

            const command =
                client.commands.get(
                    "leavemessage"
                );

            if (
                command &&
                command.memberRemove
            ) {

                await command.memberRemove(
                    member
                );
            }

        } catch (err) {

            console.error(
                "GuildMemberRemove Error",
                err
            );
        }
    }
);

client.login(
    process.env.TOKEN
);
