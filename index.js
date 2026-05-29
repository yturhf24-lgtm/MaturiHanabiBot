const express = require("express");

const {
  Client,
  GatewayIntentBits,
  Collection,
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");
const path = require("path");

// =====================
// TOKEN
// =====================
const TOKEN = "MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s";

// =====================
// CLIENT_ID自動取得
// =====================
function getClientId(token) {

  return Buffer
    .from(
      token.split(".")[0],
      "base64"
    )
    .toString();

}

const CLIENT_ID =
  getClientId(TOKEN);

// =====================
// Express
// =====================
const app = express();

const PORT =
  process.env.PORT || 3000;

app.get("/", (req, res) => {

  res.send("Bot Running");

});

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🌐 PORT ${PORT}`
    );

  }
);

// =====================
// Discord Client
// =====================
const client = new Client({

  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]

});

client.commands =
  new Collection();

// =====================
// commands読み込み
// =====================
const commandsPath =
  path.join(
    __dirname,
    "commands"
  );

if (
  !fs.existsSync(commandsPath)
) {

  fs.mkdirSync(commandsPath);

}

const commandFiles =
  fs.readdirSync(commandsPath)
    .filter(file =>
      file.endsWith(".js")
    );

for (
  const file of commandFiles
) {

  const command =
    require(
      `./commands/${file}`
    );

  client.commands.set(
    command.data.name,
    command
  );

  console.log(
    `📂 ${file}`
  );

}

// =====================
// SlashCommand
// =====================
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

// =====================
// Ready
// =====================
client.once(
  "ready",
  async () => {

    console.log(
      `🤖 ${client.user.tag}`
    );

    try {

      const commands = [];

      client.commands.forEach(
        command => {

          commands.push(
            command.data.toJSON()
          );

        }
      );

      const rest =
        new REST({
          version: "10"
        }).setToken(TOKEN);

      // 完全上書き
      await rest.put(

        Routes.applicationCommands(
          CLIENT_ID
        ),

        {
          body: commands
        }

      );

      console.log(
        "✅ Commands Updated"
      );

    } catch (err) {

      console.error(err);

    }

  }
);

// =====================
// Login
// =====================
client.login(TOKEN);
