const {
    SlashCommandBuilder,
    PermissionFlagsBits,
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
        .setName("permission-role")
        .setDescription("許可ロール管理")

        .addSubcommand(sub =>
            sub
                .setName("add")
                .setDescription("追加")
                .addRoleOption(opt =>
                    opt
                        .setName("role")
                        .setDescription("ロール")
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("remove")
                .setDescription("削除")
                .addRoleOption(opt =>
                    opt
                        .setName("role")
                        .setDescription("ロール")
                        .setRequired(true)
                )
        )

        .addSubcommand(sub =>
            sub
                .setName("list")
                .setDescription("一覧")
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

        const guildData =
            data[interaction.guild.id];

        const sub =
            interaction.options.getSubcommand();

        if (sub === "add") {

            const role =
                interaction.options.getRole(
                    "role"
                );

            if (
                !guildData.roles.includes(
                    role.id
                )
            ) {
                guildData.roles.push(
                    role.id
                );
            }

            saveJSON(file, data);

            return interaction.reply({
                content:
                    `追加: ${role}`,
                flags: MessageFlags.Ephemeral
            });
        }

        if (sub === "remove") {

            const role =
                interaction.options.getRole(
                    "role"
                );

            guildData.roles =
                guildData.roles.filter(
                    id => id !== role.id
                );

            saveJSON(file, data);

            return interaction.reply({
                content:
                    `削除: ${role}`,
                flags: MessageFlags.Ephemeral
            });
        }

        const roles =
            guildData.roles
                .map(id => `<@&${id}>`)
                .join("\n") || "なし";

        return interaction.reply({
            content: roles,
            flags: MessageFlags.Ephemeral
        });
    }
};
