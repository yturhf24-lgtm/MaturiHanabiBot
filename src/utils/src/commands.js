const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType
} = require("discord.js");

// =====================
// コマンド登録
// =====================
function registerCommands() {

  return [
    new SlashCommandBuilder()
      .setName("server")
      .setDescription("サーバー情報を表示")
      .setDescriptionLocalizations({
        ja: "サーバー情報表示"
      })
  ].map(c => c.toJSON());
}

// =====================
// 実行部分
// =====================
async function handleServerCommand(interaction) {

  const g = interaction.guild;

  // メンバー取得（正確化）
  await g.members.fetch().catch(() => {});

  const total = g.memberCount;
  const bots = g.members.cache.filter(m => m.user.bot).size;
  const humans = total - bots;

  const online = g.members.cache.filter(m => m.presence?.status === "online").size;
  const idle = g.members.cache.filter(m => m.presence?.status === "idle").size;
  const dnd = g.members.cache.filter(m => m.presence?.status === "dnd").size;
  const offline = total - (online + idle + dnd);

  const text = g.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
  const voice = g.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
  const category = g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

  // 過疎度（最大200%）
  const active = online + idle + dnd;
  const rate = total ? Math.min(200, Math.floor((active / total) * 200)) : 0;

  let activityText = "過疎";
  if (rate >= 120) activityText = "超活発";
  else if (rate >= 80) activityText = "普通";
  else if (rate >= 40) activityText = "少し過疎";

  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)
    .setTitle(`${g.name} サーバー情報`)
    .setThumbnail(g.iconURL({ dynamic: true }))
    .addFields(

      {
        name: "👥 メンバー",
        value:
`総人数: ${total}
一般: ${humans}
BOT: ${bots}`,
        inline: false
      },

      {
        name: "📶 ステータス",
        value:
`🟢 オンライン: ${online}
🌙 退席中: ${idle}
⛔ 取り込み中: ${dnd}
⚫ オフライン: ${offline}`,
        inline: false
      },

      {
        name: "📁 チャンネル",
        value:
`テキスト: ${text}
ボイス: ${voice}
カテゴリ: ${category}`,
        inline: false
      },

      {
        name: "🚀 ブースト",
        value:
`レベル: ${g.premiumTier}
回数: ${g.premiumSubscriptionCount ?? 0}`,
        inline: false
      },

      {
        name: "📉 過疎度",
        value: `${activityText} (${rate}%)`,
        inline: false
      },

      {
        name: "📅 作成日",
        value: new Date(g.createdTimestamp).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo",
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }),
        inline: false
      }

    )
    .setTimestamp();

  // 👇 全員表示（ephemeralなし）
  return interaction.reply({
    embeds: [embed]
  });
}

module.exports = {
  registerCommands,
  handleServerCommand
};
