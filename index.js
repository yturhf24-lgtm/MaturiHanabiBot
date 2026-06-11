const { execSync, spawn } = require("child_process");

// Pythonの依存関係をインストール
console.log("Installing Python dependencies...");
execSync("pip install -r requirements.txt --break-system-packages", { stdio: "inherit" });

// main.pyを起動
console.log("Starting bot...");
const bot = spawn("python", ["main.py"], { stdio: "inherit" });

bot.on("close", (code) => {
  console.log(`Bot exited with code ${code}`);
  process.exit(code);
});
