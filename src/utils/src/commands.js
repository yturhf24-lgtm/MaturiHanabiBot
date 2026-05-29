const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType
} = require('discord.js');

// =====================
// コマンド登録
// =====================
async function registerCommands(client) {

  const commands = [
    new SlashCommandBuilder()
      .setName('server')
      .setDescription('サーバー情報表示')
      .setDescriptionLocalizations({
        ja: 'サーバー情報表示'
      })
  ].map(c => c.toJSON());

  await client.application.commands.set(commands);

  console.log('✅ /server 登録完了');
}

// =====================
// 実行
// =====================
async function handleServer(interaction) {

  const g = interaction.guild;

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

  const active = online + idle + dnd;

  const rate = total
    ? Math.min(200, Math.floor((active / total) * 200))
    : 0;

  let activity = "過疎";
  if (rate >= 120) activity = "超活発";
  else if (rate >= 80) activity = "普通";
  else if (rate >= 40) activity = "少し過疎";

  // =====================
  // EMBED
  // =====================
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31)

    // ⭐ 完全自動でサーバー名取得
    .setTitle(`${interaction.guild.name} サーバー情報`)

    .setThumbnail(g.iconURL({ dynamic: true }))

    .addFields(

      {
        name: "👥 メンバー",
        value:
`総人数: ${total}
一般: ${humans}
BOT: ${bots}`
      },

      {
        name: "📶 ステータス",
        value:
`🟢 オンライン: ${online}
🌙 退席中: ${idle}
⛔ 取り込み中: ${dnd}
⚫ オフライン: ${offline}`
      },

      {
        name: "📁 チャンネル",
        value:
`テキスト: ${text}
ボイス: ${voice}
カテゴリ: ${category}`
      },

      {
        name: "🚀 ブースト",
        value:
`レベル: ${g.premiumTier}
回数: ${g.premiumSubscriptionCount ?? 0}`
      },

      {
        name: "📉 過疎度",
        value: `${activity} (${rate}%)`
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
        })
      }

    )
    .setTimestamp();

  return interaction.reply({
    embeds: [embed]
  });
}

module.exports = {
  registerCommands,
  handleServer
};
