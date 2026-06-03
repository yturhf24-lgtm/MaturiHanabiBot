const {
    SlashCommandBuilder,
    EmbedBuilder,
    MessageFlags
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
        .setName("add-role")
        .setDescription("BOT利用ロール追加")
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
                "Administrator"
            );

        if (!isOwner && !isAdmin) {

            return interaction.reply({
                content: "権限がありません",
                flags: MessageFlags.Ephemeral
            });
        }

        const role =
            interaction.options.getRole(
                "role"
            );

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

        if (
            !data[
                interaction.guild.id
            ].roles.includes(role.id)
        ) {

            data[
                interaction.guild.id
            ].roles.push(role.id);
        }

        saveJSON(file, data);

        const embed =
            new EmbedBuilder()
                .setColor("Green")
                .setTitle("✅ 追加完了")
                .setDescription(
                    `${role} を追加しました`
                );

        await interaction.reply({
            embeds: [embed]
        });
    }
};
