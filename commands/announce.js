const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder
} = require("discord.js");

const ALLOWED_USERS = [
    "1266013271518089258",
    "1323527061410676787"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("announce")
        .setDescription("埋め込みアナウンスを送信")
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

        const modal = new ModalBuilder()
            .setCustomId("announce_modal")
            .setTitle("アナウンス作成");

        const title =
            new TextInputBuilder()
                .setCustomId("announce_title")
                .setLabel("タイトル")
                .setStyle(
                    TextInputStyle.Short
                )
                .setRequired(true)
                .setMaxLength(256);

        const content =
            new TextInputBuilder()
                .setCustomId("announce_content")
                .setLabel("本文")
                .setStyle(
                    TextInputStyle.Paragraph
                )
                .setRequired(true)
                .setMaxLength(4000);

        const image =
            new TextInputBuilder()
                .setCustomId("announce_image")
                .setLabel("画像URL（任意）")
                .setStyle(
                    TextInputStyle.Short
                )
                .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder()
                .addComponents(title),
            new ActionRowBuilder()
                .addComponents(content),
            new ActionRowBuilder()
                .addComponents(image)
        );

        await interaction.showModal(
            modal
        );
    },

    async modalSubmit(interaction) {

        const title =
            interaction.fields.getTextInputValue(
                "announce_title"
            );

        const content =
            interaction.fields.getTextInputValue(
                "announce_content"
            );

        const image =
            interaction.fields.getTextInputValue(
                "announce_image"
            );

        const embed =
            new EmbedBuilder()
                .setColor("#5865F2")
                .setTitle(title)
                .setDescription(content)
                .setTimestamp();

        if (
            image &&
            image.startsWith("http")
        ) {
            embed.setImage(image);
        }

        await interaction.channel.send({
            embeds: [embed]
        });

        await interaction.reply({
            content:
                "アナウンスを送信しました。",
            ephemeral: true
        });
    }
};
