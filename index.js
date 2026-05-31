const fs = require("fs");

const {
  Client,
  Collection,
  GatewayIntentBits
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands =
  new Collection();

const commandFiles =
  fs.readdirSync("./commands")
    .filter(file =>
      file.endsWith(".js")
    );

for (const file of commandFiles) {

  const command =
    require(`./commands/${file}`);

  client.commands.set(
    command.data.name,
    command
  );
}

client.once("ready", async () => {

  await client.application.commands.set(
    client.commands.map(
      command =>
        command.data.toJSON()
    )
  );

  console.log(
    `${client.user.tag} 起動`
  );
});

client.on(
  "interactionCreate",
  async interaction => {

    if (
      !interaction.isChatInputCommand()
    ) return;

    const command =
      client.commands.get(
        interaction.commandName
      );

    if (!command) return;

    try {

      await command.execute(
        interaction
      );

    } catch (err) {

      console.error(err);

    }
  }
);

client.login(
  process.env.MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s
);
