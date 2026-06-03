const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits
} = require("discord.js");

const path = require("path");

const {
    loadJSON,
    saveJSON
} = require("../utils/jsonManager");

const OWNER_USERS = [
    "1266013271518089258",
    "1323527061410676787"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove-role")
        .setDescription("BOT利用ロール削除")
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("ロール")
                .setRequired(true)
        ),

    async execute(interaction) {

        const isOwner =
            OWNER_USERS.includes(
                interaction.user.id
            );

        const isAdmin =
            interaction.member.permissions.has(
                PermissionFlagsBits.Administrator
            );

        if (!isOwner && !isAdmin) {
            return interaction.reply({
                content: "権限がありません",
                flags: MessageFlags.Ephemeral
            });
        }

        const role =
            interaction.options.getRole("role");

        const file = path.join(
            __dirname,
            "..",
            "data",
            "permissions.json"
        );

        const data = loadJSON(file);

        if (!data[interaction.guild.id]) {
            data[interaction.guild.id] = {
                roles: []
            };
        }

        data[interaction.guild.id].roles =
            data[interaction.guild.id].roles.filter(
                id => id !== role.id
            );

        saveJSON(file, data);

        const embed =
            new EmbedBuilder()
                .setColor("Red")
                .setTitle("🗑️ 削除完了")
                .setDescription(
                    `${role} を削除しました`
                );

        await interaction.reply({
            embeds: [embed]
        });
    }
};
