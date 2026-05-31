const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

module.exports = {

    data: new SlashCommandBuilder()
        .setName("server_info")
        .setDescription("サーバー情報を表示"),

    async execute(interaction) {

        const guild = interaction.guild;

        await guild.members.fetch();

        const humans =
            guild.members.cache.filter(
                m => !m.user.bot
            ).size;

        const bots =
            guild.members.cache.filter(
                m => m.user.bot
            ).size;

        const online =
            guild.members.cache.filter(
                m =>
                    m.presence &&
                    m.presence.status !== "offline"
            ).size;

        const offline =
            guild.memberCount - online;

        const textChannels =
            guild.channels.cache.filter(
                c => c.type === 0
            ).size;

        const voiceChannels =
            guild.channels.cache.filter(
                c => c.type === 2
            ).size;

        const categories =
            guild.channels.cache.filter(
                c => c.type === 4
            ).size;

        const embed = new EmbedBuilder()
            .setColor("#2b2d31")
            .setTitle(
                `${guild.name} サーバー情報`
            )
            .setThumbnail(
                guild.iconURL({
                    dynamic: true,
                    size: 1024
                })
            )
            .addFields(
                {
                    name: "👥 メンバー",
                    value:
                        `総数: ${guild.memberCount}\n` +
                        `ユーザー: ${humans}\n` +
                        `Bot: ${bots}`,
                    inline: true
                },
                {
                    name: "🟢 ステータス",
                    value:
                        `オンライン: ${online}\n` +
                        `オフライン: ${offline}`,
                    inline: true
                },
                {
                    name: "💬 チャンネル",
                    value:
                        `テキスト: ${textChannels}\n` +
                        `ボイス: ${voiceChannels}\n` +
                        `カテゴリ: ${categories}`,
                    inline: true
                },
                {
                    name: "🚀 ブースト",
                    value:
                        `レベル: ${guild.premiumTier}\n` +
                        `回数: ${guild.premiumSubscriptionCount}`,
                    inline: true
                },
                {
                    name: "📅 作成日",
                    value:
                        `<t:${Math.floor(
                            guild.createdTimestamp / 1000
                        )}:F>`
                },
                {
                    name: "📊 過疎度",
                    value:
                        `${Math.round(
                            (online /
                                guild.memberCount) *
                                100
                        )}%`
                }
            );

        await interaction.reply({
            embeds: [embed]
        });
    }
};
