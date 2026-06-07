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
        .setName("leavemessage")
        .setDescription("退出メッセージ設定")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const modal = new ModalBuilder()
            .setCustomId(
                "leavemessage_modal"
            )
            .setTitle(
                "退出メッセージ設定"
            );

        const title =
            new TextInputBuilder()
                .setCustomId(
                    "leave_title"
                )
                .setLabel(
                    "退出タイトル"
                )
                .setStyle(
                    TextInputStyle.Short
                )
                .setRequired(true)
                .setMaxLength(256);

        const content =
            new TextInputBuilder()
                .setCustomId(
                    "leave_content"
                )
                .setLabel(
                    "退出メッセージ"
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
