import discord
from discord import app_commands
from discord.ext import commands


def is_allowed(interaction: discord.Interaction) -> bool:
    """コマンド使用を許可するか判定（オーナー or 指定ユーザー）"""
    allowed_ids: set = interaction.client.allowed_user_ids  # type: ignore
    if interaction.guild and interaction.user.id == interaction.guild.owner_id:
        return True
    return interaction.user.id in allowed_ids


class ServerInfo(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="サーバー情報", description="サーバーの詳細情報を表示します")
    async def server_info(self, interaction: discord.Interaction):
        if not is_allowed(interaction):
            await interaction.response.send_message(
                "❌ このコマンドを使用する権限がありません。", ephemeral=True
            )
            return

        guild = interaction.guild
        if guild is None:
            await interaction.response.send_message(
                "❌ サーバー内でのみ使用できます。", ephemeral=True
            )
            return

        await interaction.response.defer()

        # メンバー情報
        total_members = guild.member_count or 0
        bots = sum(1 for m in guild.members if m.bot)
        humans = total_members - bots

        # チャンネル情報
        text_channels = len(guild.text_channels)
        voice_channels = len(guild.voice_channels)
        categories = len(guild.categories)
        stage_channels = len(guild.stage_channels)
        forum_channels = len(guild.forums)
        total_channels = text_channels + voice_channels + stage_channels + forum_channels

        # ロール情報（@everyone を除く）
        roles = [r for r in guild.roles if r.name != "@everyone"]
        roles_sorted = sorted(roles, key=lambda r: r.position, reverse=True)
        role_mentions = " ".join([r.mention for r in roles_sorted[:20]])
        if len(roles) > 20:
            role_mentions += f" ... 他{len(roles) - 20}個"

        # ブースト情報
        boost_level = guild.premium_tier
        boost_count = guild.premium_subscription_count or 0

        # 認証レベル
        verification_map = {
            discord.VerificationLevel.none: "なし",
            discord.VerificationLevel.low: "低（メール認証済み）",
            discord.VerificationLevel.medium: "中（Discord登録から5分以上）",
            discord.VerificationLevel.high: "高（サーバー参加から10分以上）",
            discord.VerificationLevel.highest: "最高（電話番号認証済み）",
        }
        verification = verification_map.get(guild.verification_level, "不明")

        # コンテンツフィルター
        filter_map = {
            discord.ContentFilter.disabled: "無効",
            discord.ContentFilter.no_role: "ロールなしメンバーのみ",
            discord.ContentFilter.all_members: "全メンバー",
        }
        content_filter = filter_map.get(guild.explicit_content_filter, "不明")

        # 作成日時
        created_at = discord.utils.format_dt(guild.created_at, style="F")
        created_at_relative = discord.utils.format_dt(guild.created_at, style="R")

        # オーナー
        owner = guild.owner
        owner_str = owner.mention if owner else "不明"

        # サーバー機能
        features_map = {
            "COMMUNITY": "コミュニティ",
            "PARTNERED": "パートナー",
            "VERIFIED": "認証済み",
            "DISCOVERABLE": "サーバー検索対象",
            "ANIMATED_ICON": "アニメーションアイコン",
            "BANNER": "バナー",
            "INVITE_SPLASH": "招待スプラッシュ",
            "VANITY_URL": "カスタムURL",
            "NEWS": "ニュースチャンネル",
            "TICKETED_EVENTS_ENABLED": "チケットイベント",
            "WELCOME_SCREEN_ENABLED": "ウェルカム画面",
            "MEMBER_VERIFICATION_GATE_ENABLED": "メンバー認証ゲート",
            "MONETIZATION_ENABLED": "マネタイズ",
            "MORE_STICKERS": "スタンプ追加枠",
            "THREADS_ENABLED": "スレッド",
            "ROLE_ICONS": "ロールアイコン",
            "PREVIEW_ENABLED": "プレビュー",
        }
        guild_features = [features_map.get(f, f) for f in guild.features]
        features_str = "、".join(guild_features) if guild_features else "なし"

        # Embed作成
        embed = discord.Embed(
            title=f"🏯 {guild.name} のサーバー情報",
            color=discord.Color.blurple(),
        )

        if guild.icon:
            embed.set_thumbnail(url=guild.icon.url)
        if guild.banner:
            embed.set_image(url=guild.banner.url)

        embed.add_field(name="🆔 サーバーID", value=str(guild.id), inline=True)
        embed.add_field(name="👑 オーナー", value=owner_str, inline=True)
        embed.add_field(
            name="📅 作成日時",
            value=f"{created_at}\n（{created_at_relative}）",
            inline=False,
        )
        embed.add_field(
            name="👥 メンバー",
            value=f"合計: **{total_members}**\n🧑 人間: **{humans}**\n🤖 Bot: **{bots}**",
            inline=True,
        )
        embed.add_field(
            name="💬 チャンネル",
            value=(
                f"合計: **{total_channels}**\n"
                f"📝 テキスト: **{text_channels}**\n"
                f"🔊 ボイス: **{voice_channels}**\n"
                f"🗂️ カテゴリー: **{categories}**\n"
                f"🎭 ステージ: **{stage_channels}**\n"
                f"📋 フォーラム: **{forum_channels}**"
            ),
            inline=True,
        )
        embed.add_field(
            name="🎖️ ロール",
            value=f"合計: **{len(roles)}**個\n{role_mentions}" if roles else "なし",
            inline=False,
        )
        embed.add_field(
            name="🚀 サーバーブースト",
            value=f"レベル: **{boost_level}**\nブースト数: **{boost_count}**",
            inline=True,
        )
        embed.add_field(name="🔒 認証レベル", value=verification, inline=True)
        embed.add_field(name="🛡️ コンテンツフィルター", value=content_filter, inline=True)
        embed.add_field(name="✨ サーバー機能", value=features_str, inline=False)

        embed.set_footer(text=f"情報取得: {interaction.user.display_name}")

        await interaction.followup.send(embed=embed)


async def setup(bot: commands.Bot):
    await bot.add_cog(ServerInfo(bot))
