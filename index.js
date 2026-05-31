const {
  Client,
  GatewayIntentBits,
  Collection
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const client = new Client({

  intents: [

    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent

  ]

});

client.commands = new Collection();

const commandFiles = fs

  .readdirSync(
    path.join(
      __dirname,
      "commands"
    )
  )

  .filter(
    file =>
      file.endsWith(".js")
  );

for (
  const file
  of commandFiles
) {

  const command =
    require(
      `./commands/${file}`
    );

  if (
    command.data &&
    command.execute
  ) {

    client.commands.set(
      command.data.name,
      command
    );

  }

}

client.once(
  "ready",
  async () => {

    try {

      await client.application.commands.set(

        client.commands.map(
          cmd =>
            cmd.data.toJSON()
        )

      );

      console.log(
        `✅ ${client.user.tag}`
      );

    } catch (err) {

      console.error(err);

    }

  }
);

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

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction.followUp({

          content:
            "❌ エラー",

          ephemeral:
            true

        });

      } else {

        await interaction.reply({

          content:
            "❌ エラー",

          ephemeral:
            true

        });

      }

    }

  }
);

client.on(
  "guildMemberAdd",
  async member => {

    try {

      const monitor =
        require(
          "./commands/monitor"
        );

      if (
        monitor.memberJoin
      ) {

        await monitor.memberJoin(
          member
        );

      }

    } catch (err) {

      console.error(err);

    }

  }
);

client.login(
  "MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s"
);
