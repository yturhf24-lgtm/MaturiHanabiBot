const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("joinmessage")
        .setDescription("参加メッセージ設定")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const modal = new ModalBuilder()
            .setCustomId(
                "joinmessage_modal"
            )
            .setTitle(
                "参加メッセージ設定"
            );

        const title =
            new TextInputBuilder()
                .setCustomId(
                    "join_title"
                )
                .setLabel(
                    "参加タイトル"
                )
                .setStyle(
                    TextInputStyle.Short
                )
                .setRequired(true)
                .setMaxLength(256);

        const content =
            new TextInputBuilder()
                .setCustomId(
                    "join_content"
                )
                .setLabel(
                    "参加メッセージ"
                )
                .setStyle(
                    TextInputStyle.Paragraph
                )
                .setRequired(true)
                .setMaxLength(4000);

        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(title),
            new ActionRowBuilder()
                .addComponents(content)
        );

        await interaction.showModal(
            modal
        );
    }
};
