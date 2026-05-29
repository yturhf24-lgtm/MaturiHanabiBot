const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("サーバー情報を表示します"),

  async execute(interaction) {
    const guild = interaction.guild;

    await guild.members.fetch();

    // ===== メンバー =====
    const members = guild.members.cache;
    const total = members.size;
    const bots = members.filter(m => m.user.bot).size;
    const humans = total - bots;

    // ステータス
    const online = members.filter(m => m.presence?.status === "online").size;
    const idle = members.filter(m => m.presence?.status === "idle").size;
    const dnd = members.filter(m => m.presence?.status === "dnd").size;
    const offline = members.filter(
      m => !m.presence || m.presence.status === "offline"
    ).size;

    // チャンネル
    const text = guild.channels.cache.filter(c => c.type === 0).size;
    const voice = guild.channels.cache.filter(c => c.type === 2).size;
    const category = guild.channels.cache.filter(c => c.type === 4).size;

    // ブースト
    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount || 0;

    // 過疎度（雑に計算）
    const activityRate = Math.round((online / total) * 100) || 0;
    let activityText = "超過疎";
    if (activityRate >= 60) activityText = "活発";
    else if (activityRate >= 30) activityText = "普通";
    else if (activityRate > 10) activityText = "少し過疎";

    // 日付
    const created = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;

    // ===== Embed =====
    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle("📊 サーバー情報")
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        {
          name: "👥 メンバー",
          value:
            `総人数: ${total}\n` +
            `一般: ${humans}\n` +
            `BOT: ${bots}`,
          inline: false
        },
        {
          name: "📶 ステータス",
          value:
            `🟢 オンライン: ${online}\n` +
            `🌙 退席中: ${idle}\n` +
            `⛔ 取り込み中: ${dnd}\n` +
            `⚫ オフライン: ${offline}`,
          inline: false
        },
        {
          name: "📁 チャンネル",
          value:
            `テキスト: ${text}\n` +
            `ボイス: ${voice}\n` +
            `カテゴリ: ${category}`,
          inline: false
        },
        {
          name: "🚀 ブースト",
          value:
            `レベル: ${boostLevel}\n` +
            `回数: ${boostCount}`,
          inline: false
        },
        {
          name: "📉 過疎度",
          value: `${activityText} (${activityRate}%)`,
          inline: false
        },
        {
          name: "📅 作成日",
          value: created,
          inline: false
        }
      )
      .setFooter({ text: guild.name });

    await interaction.reply({ embeds: [embed] });
  }
};
