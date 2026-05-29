const {
  REST,
  Routes
} = require("discord.js");

const fs = require("fs");

const {
  TOKEN,
  CLIENT_ID
} = require("./index");

const commands = [];

// =====================
// commands 読み込み
// =====================
const commandFiles = fs
  .readdirSync("./commands")
  .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {

  const command = require(`./commands/${file}`);

  commands.push(
    command.data.toJSON()
  );
}

// =====================
// REST
// =====================
const rest = new REST({
  version: "10"
}).setToken(TOKEN);

// =====================
// 完全上書き保存
// =====================
(async () => {

  try {

    console.log("🧹 古いコマンド上書き中...");

    // applicationCommands は body を丸ごと置換する
    // つまり「完全上書き」
    await rest.put(
      Routes.applicationCommands(
        CLIENT_ID
      ),
      {
        body: commands
      }
    );

    console.log("✅ 最新コマンドで上書き完了");

  } catch (err) {

    console.error(err);

  }

})();
