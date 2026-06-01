require("dotenv").config();

const { REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));

    if ("data" in command && "execute" in command) {
        commands.push(command.data.toJSON());
    }
}

const rest = new REST({ version: "10" }).setToken(
    process.env.TOKEN
);

(async () => {
    try {

        console.log(
            `${commands.length}個のコマンドを登録中...`
        );

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            {
                body: commands
            }
        );

        console.log("コマンド登録完了");

    } catch (error) {
        console.error(error);
    }
})();
