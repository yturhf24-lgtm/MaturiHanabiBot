require("dotenv").config();

const fs = require("fs");
const path = require("path");

const {
Client,
Collection,
GatewayIntentBits,
Events
} = require("discord.js");

const client = new Client({
intents: [
GatewayIntentBits.Guilds
]
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

for (const file of commandFiles) {
const filePath = path.join(commandsPath, file);
const command = require(filePath);

```
if ("data" in command && "execute" in command) {
    client.commands.set(command.data.name, command);
}
```

}

client.once(Events.ClientReady, () => {
console.log(`${client.user.tag} 起動完了`);
});

client.on(Events.InteractionCreate, async interaction => {

```
if (!interaction.isChatInputCommand()) return;

const command = client.commands.get(interaction.commandName);

if (!command) return;

try {
    await command.execute(interaction);
} catch (error) {
    console.error(error);

    if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
            content: "エラーが発生しました。",
            ephemeral: true
        });
    } else {
        await interaction.reply({
            content: "エラーが発生しました。",
            ephemeral: true
        });
    }
}
```

});

client.login(process.env.TOKEN);
