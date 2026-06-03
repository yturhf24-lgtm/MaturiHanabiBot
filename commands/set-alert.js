const {
    SlashCommandBuilder,
    EmbedBuilder,
    ChannelType,
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
        .setName("set-alert")
        .setDescription("監視通知先を設定")
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("通知先")
                .addChannelTypes(
                    ChannelType.GuildText
                )
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

        const channel =
            interaction.options.getChannel(
                "channel"
            );

        const file = path.join(
            __dirname,
            "..",
            "data",
            "monitor.json"
        );

        const data = loadJSON(file);

        if (!data[interaction.guild.id]) {

            data[interaction.guild.id] = {};
        }

        data[
            interaction.guild.id
        ].alertChannel = channel.id;

        saveJSON(file, data);

        const embed =
            new EmbedBuilder()
                .setColor("Green")
                .setTitle("✅ 設定完了")
                .setDescription(
                    `通知先を ${channel} に設定しました。`
                );

        await interaction.reply({
            embeds: [embed]
        });
    }
};
