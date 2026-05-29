require("dotenv").config();

const {
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");

const commands = [];

const commandFiles = fs
  .readdirSync("./commands")
  .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {

  const command = require(`./commands/${file}`);

  commands.push(
    command.data.toJSON()
  );
}

const rest = new REST({
  version: "10"
}).setToken(process.env.DISCORD_TOKEN);

(async () => {

  try {

    console.log("💾 コマンド保存中...");

    await rest.put(
      Routes.applicationCommands(
        process.env.CLIENT_ID
      ),
      {
        body: commands
      }
    );

    console.log("✅ 保存完了");

  } catch (err) {

    console.error(err);

  }

})();
