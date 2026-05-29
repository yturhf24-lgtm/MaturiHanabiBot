const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("サーバー情報を表示"),

  async execute(interaction) {
    const guild = interaction.guild;

    await guild.members.fetch();

    const members = guild.members.cache;

    const total = members.size;
    const bots = members.filter(m => m.user.bot).size;
    const humans = total - bots;

    const online = members.filter(m => m.presence?.status === "online").size;
    const idle = members.filter(m => m.presence?.status === "idle").size;
    const dnd = members.filter(m => m.presence?.status === "dnd").size;
    const offline = members.filter(m => !m.presence || m.presence.status === "offline").size;

    const text = guild.channels.cache.filter(c => c.type === 0).size;
    const voice = guild.channels.cache.filter(c => c.type === 2).size;
    const category = guild.channels.cache.filter(c => c.type === 4).size;

    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount || 0;

    const rate = Math.round((online / total) * 100) || 0;

    let status = "少し過疎";
    if (rate >= 60) status = "活発";
    else if (rate >= 30) status = "普通";
    else if (rate <= 10) status = "超過疎";

    const created = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle("📊 サーバー情報")
      .setThumbnail(guild.iconURL({ dynamic: true }))
      .addFields(
        {
          name: "👥 メンバー",
          value: `総人数: ${total}\n一般: ${humans}\nBOT: ${bots}`
        },
        {
          name: "📶 ステータス",
          value:
            `🟢 オンライン: ${online}\n🌙 退席中: ${idle}\n⛔ 取り込み中: ${dnd}\n⚫ オフライン: ${offline}`
        },
        {
          name: "📁 チャンネル",
          value: `テキスト: ${text}\nボイス: ${voice}\nカテゴリ: ${category}`
        },
        {
          name: "🚀 ブースト",
          value: `レベル: ${boostLevel}\n回数: ${boostCount}`
        },
        {
          name: "📉 過疎度",
          value: `${status} (${rate}%)`
        },
        {
          name: "📅 作成日",
          value: created
        }
      )
      .setFooter({ text: guild.name });

    await interaction.reply({ embeds: [embed] });
  }
};
