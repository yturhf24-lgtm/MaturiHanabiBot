const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

const ALLOWED_USERS = [
    "1266013271518089258",
    "1323527061410676787"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("joinlog")
        .setDescription("参加ログ設定"),

    async execute(interaction) {

        const isOwner =
            interaction.guild.ownerId ===
            interaction.user.id;

        const isAllowed =
            ALLOWED_USERS.includes(
                interaction.user.id
            );

        if (
            !isOwner &&
            !isAllowed
        ) {
            return interaction.reply({
                content:
                    "このコマンドは使用できません。",
                ephemeral: true
            });
        }

        const modal =
            new ModalBuilder()
                .setCustomId(
                    "joinlog_modal"
                )
                .setTitle(
                    "参加ログ設定"
                );

        const channel =
            new TextInputBuilder()
                .setCustomId(
                    "join_channel"
                )
                .setLabel(
                    "チャンネルID (offで無効)"
                )
                .setStyle(
                    TextInputStyle.Short
                )
                .setRequired(true);

        const title =
            new TextInputBuilder()
                .setCustomId(
                    "join_title"
                )
                .setLabel(
                    "タイトル"
                )
                .setStyle(
                    TextInputStyle.Short
                )
                .setRequired(true);

        const message =
            new TextInputBuilder()
                .setCustomId(
                    "join_message"
                )
                .setLabel(
                    "メッセージ"
                )
                .setStyle(
                    TextInputStyle.Paragraph
                )
                .setRequired(true)
                .setMaxLength(4000);

        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(channel),

            new ActionRowBuilder()
                .addComponents(title),

            new ActionRowBuilder()
                .addComponents(message)
        );

        await interaction.showModal(
            modal
        );
    }
};
