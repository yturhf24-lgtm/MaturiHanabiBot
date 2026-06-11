import discord
from discord.ext import commands
import os

# ===== 設定 =====
ALLOWED_USER_IDS = {
    1323527061410676787,
    1266013271518089258,
}

# ================

intents = discord.Intents.default()
intents.members = True
intents.guilds = True

bot = commands.Bot(command_prefix="!", intents=intents)
bot.allowed_user_ids = ALLOWED_USER_IDS


@bot.event
async def on_ready():
    # Cogsの読み込み
    for filename in os.listdir("./cogs"):
        if filename.endswith(".py"):
            await bot.load_extension(f"cogs.{filename[:-3]}")
            print(f"✅ Cog読み込み: {filename}")

    await bot.tree.sync()
    print(f"✅ ログイン成功: {bot.user} (ID: {bot.user.id})")
    print("スラッシュコマンドを同期しました")


if __name__ == "__main__":
    token = os.environ.get("DISCORD_TOKEN")
    if not token:
        raise ValueError("環境変数 DISCORD_TOKEN が設定されていません")
    bot.run(token)
