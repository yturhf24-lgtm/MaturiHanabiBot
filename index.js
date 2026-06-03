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

        console.log(`Loading ${file}`);

        const command = require(
            path.join(commandsPath, file)
        );

        console.log(
            `Name: ${command?.data?.name}`
        );

        commands.push(
            command.data.toJSON()
        );

        client.commands.set(
            command.data.name,
            command
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
