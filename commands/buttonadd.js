const {
    SlashCommandBuilder,
    PermissionFlagsBits,
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
        .setName("buttonadd")
        .setDescription("ボタン、説明を作成")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {

        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
        const isAllowedUser = ALLOWED_USERS.includes(interaction.user.id);

        if (!isAdmin && !isAllowedUser) {
            return interaction.reply({
                content: "このコマンドは使用できません",
                ephemeral: true
            });
        }

        const modal = new ModalBuilder()
            .setCustomId("button_create")
            .setTitle("ボタン、説明作成");

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
