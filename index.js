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
