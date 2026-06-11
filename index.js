const { spawn } = require("child_process");

// main.pyを起動
console.log("Starting bot...");
const bot = spawn("python3", ["main.py"], { stdio: "inherit" });

bot.on("close", (code) => {
  console.log(`Bot exited with code ${code}`);
  process.exit(code);
});
