const {
    SlashCommandBuilder,
    ChannelType,
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
        .setName("leavelog")
        .setDescription("退出ログ設定")
        .addChannelOption(option =>
            option
                .setName("チャンネル")
                .setDescription("退出ログチャンネル")
                .addChannelTypes(
                    ChannelType.GuildText
                )
                .setRequired(true)
        ),

    async execute(interaction) {

        const isOwner =
            interaction.guild.ownerId ===
            interaction.user.id;

        const isAllowed =
            ALLOWED_USERS.includes(
                interaction.user.id
            );

        if (!isOwner && !isAllowed) {
            return interaction.reply({
                content:
                    "このコマンドは使用できません。",
                ephemeral: true
            });
        }

        const channel =
            interaction.options.getChannel(
                "チャンネル"
            );

        const modal =
            new ModalBuilder()
                .setCustomId(
                    `leavelog_modal_${channel.id}`
                )
                .setTitle(
                    "退出ログ設定"
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

        const message =
            new TextInputBuilder()
                .setCustomId(
                    "leave_message"
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
                .addComponents(message)
        );

        await interaction.showModal(
            modal
        );
    }
};
