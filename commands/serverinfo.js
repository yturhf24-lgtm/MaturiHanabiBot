const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const OWNER_ID = "1266013271518089258";

module.exports = {
    data: new SlashCommandBuilder()
        .setName("serverinfo")
        .setDescription("サーバー情報を表示"),

    async execute(interaction) {

        const isOwner =
            interaction.user.id === OWNER_ID;

        const isAdmin =
            interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            );

        if (!isOwner && !isAdmin) {
            return interaction.reply({
                content: "❌ このコマンドは管理者のみ使用できます。",
                ephemeral: true
            });
        }

        const guild = interaction.guild;

        await guild.members.fetch();

        const members = guild.memberCount;

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
                m => m.presence?.status === "online"
            ).size;

        const idle =
            guild.members.cache.filter(
                m => m.presence?.status === "idle"
            ).size;

        const dnd =
            guild.members.cache.filter(
                m => m.presence?.status === "dnd"
            ).size;

        const offline =
            guild.members.cache.filter(
                m =>
                    !m.presence ||
                    m.presence.status === "offline"
            ).size;

        const textChannels =
            guild.channels.cache.filter(
                c => c.type === ChannelType.GuildText
            ).size;

        const voiceChannels =
            guild.channels.cache.filter(
                c => c.type === ChannelType.GuildVoice
            ).size;

        const categories =
            guild.channels.cache.filter(
                c => c.type === ChannelType.GuildCategory
            ).size;

        const boostLevel =
            guild.premiumTier;

        const boostCount =
            guild.premiumSubscriptionCount || 0;

        const activity =
            Math.round(
                ((online + idle + dnd) /
                Math.max(humans, 1)) * 100
            );

        let activityText = "超過疎";

        if (activity >= 80) {
            activityText = "超活発";
        } else if (activity >= 60) {
            activityText = "活発";
        } else if (activity >= 40) {
            activityText = "普通";
        } else if (activity >= 20) {
            activityText = "やや過疎";
        }

        const embed = new EmbedBuilder()
            .setColor("#2B2D31")
            .setTitle(`${guild.name} サーバー情報`)
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
                        `総数: ${members}\n` +
                        `ユーザー: ${humans}\n` +
                        `Bot: ${bots}`,
                    inline: true
                },
                {
                    name: "🟢 ステータス",
                    value:
                        `🟢 オンライン: ${online}\n` +
                        `🌙 退席中: ${idle}\n` +
                        `⛔ 取り込み中: ${dnd}\n` +
                        `⚫ オフライン: ${offline}`,
                    inline: true
                },
                {
                    name: "📁 チャンネル",
                    value:
                        `テキスト: ${textChannels}\n` +
                        `ボイス: ${voiceChannels}\n` +
                        `カテゴリ: ${categories}`,
                    inline: true
                },
                {
                    name: "🚀 ブースト",
                    value:
                        `レベル: ${boostLevel}\n` +
                        `回数: ${boostCount}`,
                    inline: true
                },
                {
                    name: "👑 オーナー",
                    value: `<@${guild.ownerId}>`,
                    inline: true
                },
                {
                    name: "😀 絵文字数",
                    value: `${guild.emojis.cache.size}`,
                    inline: true
                },
                {
                    name: "🎭 ロール数",
                    value: `${guild.roles.cache.size}`,
                    inline: true
                },
                {
                    name: "📊 過疎度",
                    value: `${activity}% (${activityText})`,
                    inline: true
                },
                {
                    name: "📅 作成日",
                    value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`,
                    inline: false
                }
            )
            .setFooter({
                text: `サーバーID: ${guild.id}`
            })
            .setTimestamp();

        await interaction.reply({
            embeds: [embed]
        });
    }
};
