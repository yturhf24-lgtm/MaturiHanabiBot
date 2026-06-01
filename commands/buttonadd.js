const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("buttonadd")
        .setDescription("ボタンを作成")
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const modal = new ModalBuilder()
            .setCustomId("button_create")
            .setTitle("ボタン作成");

        const buttonName = new TextInputBuilder()
            .setCustomId("button_name")
            .setLabel("ボタン名")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const description = new TextInputBuilder()
            .setCustomId("button_desc")
            .setLabel("説明")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const message = new TextInputBuilder()
            .setCustomId("button_message")
            .setLabel("押した時のメッセージ")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(buttonName),
            new ActionRowBuilder().addComponents(description),
            new ActionRowBuilder().addComponents(message)
        );

        await interaction.showModal(modal);
    }
};
