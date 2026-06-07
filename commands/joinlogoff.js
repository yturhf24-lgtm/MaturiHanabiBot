const {
    SlashCommandBuilder
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const ALLOWED_USERS = [
    "1266013271518089258",
    "1323527061410676787"
];

const DATA_FILE = path.join(
    __dirname,
    "..",
    "data",
    "memberlogs.json"
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("joinlogoff")
        .setDescription("参加ログを無効化"),

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

        let data = {};

        if (
            fs.existsSync(DATA_FILE)
        ) {
            data = JSON.parse(
                fs.readFileSync(
                    DATA_FILE,
                    "utf8"
                )
            );
        }

        if (
            !data[
                interaction.guild.id
            ]
        ) {
            data[
                interaction.guild.id
            ] = {};
        }

        data[
            interaction.guild.id
        ].joinChannel = null;

        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                data,
                null,
                2
            )
        );

        await interaction.reply({
            content:
                "✅ 参加ログを無効化しました",
            ephemeral: true
        });
    }
};
