const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(
    __dirname,
    "..",
    "data",
    "memberlogs.json"
);

module.exports = {
    data: new SlashCommandBuilder()
        .setName("joinlog")
        .setDescription("参加ログチャンネル設定")
        .addChannelOption(option =>
            option
                .setName("チャンネル")
                .setDescription("未指定でOFF")
                .addChannelTypes(
                    ChannelType.GuildText
                )
                .setRequired(false)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {

        const channel =
            interaction.options.getChannel(
                "チャンネル"
            );

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
        ].joinChannel =
            channel
                ? channel.id
                : null;

        fs.writeFileSync(
            DATA_FILE,
            JSON.stringify(
                data,
                null,
                2
            )
        );

        await interaction.reply({
            content: channel
                ? `✅ 参加ログを ${channel} に設定しました`
                : "✅ 参加ログをOFFにしました",
            ephemeral: true
        });
    }
};
