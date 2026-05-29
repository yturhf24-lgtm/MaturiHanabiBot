require("dotenv").config();
const { REST, Routes } = require("discord.js");
const fs = require("fs");

const commands = [];

const files = fs.readdirSync("./commands").filter(f => f.endsWith(".js"));

for (const file of files) {
  const cmd = require(`./commands/${file}`);
  commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("💾 コマンド保存中...（完全上書き）");

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log("✅ 保存完了（これが唯一の正解）");
  } catch (err) {
    console.error(err);
  }
})();
