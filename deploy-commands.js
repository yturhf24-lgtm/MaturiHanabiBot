const {
  REST,
  Routes
} = require("discord.js");

const {
  TOKEN,
  CLIENT_ID
} = require("./index");

const rest = new REST({
  version: "10"
}).setToken(TOKEN);

(async () => {

  try {

    console.log("🧹 全コマンド削除中...");

    await rest.put(
      Routes.applicationCommands(
        CLIENT_ID
      ),
      {
        body: []
      }
    );

    console.log("✅ 全削除完了");

  } catch (err) {

    console.error(err);

  }

})();
