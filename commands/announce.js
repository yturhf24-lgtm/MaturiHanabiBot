const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
} = require("discord.js");

const ALLOWED_USERS = [
    "1266013271518089258",
    "1323527061410676787"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("announce")
        .setDescription("アナウンスを送信")
        .addStringOption(option =>
            option
                .setName("タイトル")
                .setDescription("タイトル")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("内容")
                .setDescription("内容")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const isAdmin =
            interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            );

        const isAllowedUser =
            ALLOWED_USERS.includes(
                interaction.user.id
            );

        if (!isAdmin && !isAllowedUser) {
            return interaction.reply({
                content:
                    "このコマンドは使用できません",
                ephemeral: true
            });
        }

        const title =
            interaction.options.getString(
                "タイトル"
            );

        const content =
            interaction.options.getString(
                "内容"
            );

        const embed =
            new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle(title)
                .setDescription(content)
                .setTimestamp();

        await interaction.channel.send({
            embeds: [embed]
        });

        await interaction.reply({
            content:
                "アナウンス送信完了",
            ephemeral: true
        });
    }
};
