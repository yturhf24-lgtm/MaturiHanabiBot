# 📁 commands/server.js（完成版）

```js id="final_server_info_command"
const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

module.exports = {

  // =====================
  // コマンド情報
  // =====================
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("サーバー情報を表示"),

  // =====================
  // 実行
  // =====================
  async execute(interaction) {

    const g = interaction.guild;

    // メンバー取得
    await g.members.fetch();

    const members = g.members.cache;

    // =====================
    // メンバー
    // =====================
    const total = members.size;

    const bots = members.filter(
      m => m.user.bot
    ).size;

    const humans = total - bots;

    // =====================
    // ステータス
    // =====================
    const online = members.filter(
      m => m.presence?.status === "online"
    ).size;

    const idle = members.filter(
      m => m.presence?.status === "idle"
    ).size;

    const dnd = members.filter(
      m => m.presence?.status === "dnd"
    ).size;

    const offline =
      total - (online + idle + dnd);

    // =====================
    // チャンネル
    // =====================
    const text = g.channels.cache.filter(
      c => c.type === 0
    ).size;

    const voice = g.channels.cache.filter(
      c => c.type === 2
    ).size;

    const category = g.channels.cache.filter(
      c => c.type === 4
    ).size;

    // =====================
    // 過疎度（250）
    // =====================
    const active =
      online + idle + dnd;

    const rate = total
      ? Math.min(
          250,
          Math.floor((active / total) * 250)
        )
      : 0;

    let activity = "過疎";

    if (rate >= 180)
      activity = "超活発";

    else if (rate >= 120)
      activity = "活発";

    else if (rate >= 100)
      activity = "やばい";

    else if (rate >= 60)
      activity = "普通";

    // =====================
    // 作成日
    // =====================
    const created =
      `<t:${Math.floor(g.createdTimestamp / 1000)}:F>`;

    // =====================
    // Embed
    // =====================
    const embed = new EmbedBuilder()

      .setColor(0x5865f2)

      .setTitle(
        `📊 ${g.name} サーバー情報`
      )

      .setThumbnail(
        g.iconURL({ dynamic: true })
      )

      .addFields(

        {
          name: "👥 メンバー",
          value:
`総人数: ${total}
一般: ${humans}
BOT: ${bots}`,
          inline: true
        },

        {
          name: "📶 ステータス",
          value:
`🟢 オンライン: ${online}
🌙 退席中: ${idle}
⛔ 取り込み中: ${dnd}
⚫ オフライン: ${offline}`,
          inline: true
        },

        {
          name: "📁 チャンネル",
          value:
`テキスト: ${text}
ボイス: ${voice}
カテゴリ: ${category}`,
          inline: true
        },

        {
          name: "🚀 ブースト",
          value:
`レベル: ${g.premiumTier}
回数: ${g.premiumSubscriptionCount || 0}`,
          inline: true
        },

        {
          name: "📉 過疎度",
          value:
`${activity} (${rate}/250)`,
          inline: true
        },

        {
          name: "📅 作成日",
          value: created,
          inline: true
        }

      )

      .setFooter({
        text: g.name
      })

      .setTimestamp();

    // =====================
    // 返信
    // =====================
    await interaction.reply({
      embeds: [embed]
    });

  }
};
```
