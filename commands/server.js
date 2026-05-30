const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType
} = require("discord.js");

const {
  checkAdmin
} = require("./utils/checkAdmin");

module.exports = {

  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("サーバー情報"),

  async execute(interaction) {

    if (!checkAdmin(interaction)) {
      return interaction.reply({
        content: "❌ 管理者専用コマンドです",
        ephemeral: true
      });
    }

    const g = interaction.guild;

    if (!g.members.cache.size) {
      await g.members.fetch();
    }

    const total = g.memberCount;

    const bots = g.members.cache.filter(m => m.user.bot).size;
    const humans = total - bots;

    const online = g.members.cache.filter(m => m.presence?.status === "online").size;
    const idle = g.members.cache.filter(m => m.presence?.status === "idle").size;
    const dnd = g.members.cache.filter(m => m.presence?.status === "dnd").size;

    const offline = g.members.cache.filter(
      m => !m.presence || m.presence.status === "offline"
    ).size;

    const text = g.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voice = g.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const category = g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

    const roles = g.roles.cache.size - 1;

    const active = online + idle + dnd;

    const rate = total
      ? Math.floor((active / total) * 100)
      : 0;

    let activity = "過疎";

    if (rate >= 90) activity = "超活発";
    else if (rate >= 75) activity = "活発";
    else if (rate >= 50) activity = "普通";
    else if (rate >= 25) activity = "やや過疎";

    const embed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`${g.name} サーバー情報`)
      .setThumbnail(
        g.iconURL({ dynamic: true, size: 1024 }) || null
      )
      .addFields(
        {
          name: "👥 メンバー",
          value:
`総数: ${total}
ユーザー: ${humans}
Bot: ${bots}`,
          inline: true
        },
        {
          name: "📶 ステータス",
          value:
`🟢 ${online}
🌙 ${idle}
⛔ ${dnd}
⚫ ${offline}`,
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
          name: "🏷️ ロール",
          value: `総数: ${roles}`,
          inline: true
        },
        {
          name: "🚀 ブースト",
          value:
`Lv: ${g.premiumTier}
回数: ${g.premiumSubscriptionCount || 0}`,
          inline: true
        },
        {
          name: "📅 作成日",
          value: new Date(g.createdAt).toLocaleString("ja-JP", {
            timeZone: "Asia/Tokyo"
          }),
          inline: false
        },
        {
          name: "📉 過疎度",
          value: `${rate}% (${activity})`,
          inline: true
        }
      );

    await interaction.reply({
      embeds: [embed]
    });

  }
};
