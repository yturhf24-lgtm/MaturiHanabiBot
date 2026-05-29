const express = require("express");
const fs = require("fs");
const path = require("path");

const {
  Client,
  GatewayIntentBits,
  Collection
} = require("discord.js");

// =====================
// TOKEN
// =====================
const TOKEN = "MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s";

// =====================
// CLIENT_ID自動取得
// =====================
function getClientId(token) {
  return Buffer
    .from(token.split(".")[0], "base64")
    .toString();
}

const CLIENT_ID = getClientId(TOKEN);

// =====================
// Express
// =====================
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Web Server Running : ${PORT}`);
});

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

client.commands = new Collection();

// =====================
// commands 読み込み
// =====================
const commandsPath = path.join(
  __dirname,
  "commands"
);

if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath);
}

const commandFiles = fs
  .readdirSync(commandsPath)
  .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {

  const command = require(
    `./commands/${file}`
  );

  client.commands.set(
    command.data.name,
    command
  );

  console.log(`📂 Loaded : ${file}`);
}

// =====================
// interaction
// =====================
client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand())
      return;

    const command = client.commands.get(
      interaction.commandName
    );

    if (!command) return;

    try {

      await command.execute(interaction);

    } catch (err) {

      console.error(err);

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction.followUp({
          content:
            "❌ エラーが発生しました",
          ephemeral: true
        });

      } else {

        await interaction.reply({
          content:
            "❌ エラーが発生しました",
          ephemeral: true
        });

      }
    }
  }
);

// =====================
// 起動
// =====================
client.once("ready", () => {

  console.log("=================");
  console.log(
    `🤖 ${client.user.tag}`
  );
  console.log("=================");

});

// =====================
// Login
// =====================
client.login(TOKEN);

// export
module.exports = {
  TOKEN,
  CLIENT_ID
};
