const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const path = require("path");

const {
    loadJSON
} = require("../utils/jsonManager");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("monitor-status")
        .setDescription("監視状況確認"),

    async execute(interaction) {

        const file = path.join(
            __dirname,
            "..",
            "data",
            "monitor.json"
        );

        const data = loadJSON(file);

        const config =
            data[interaction.guild.id] || {};

        const embed =
            new EmbedBuilder()
                .setColor("Blue")
                .setTitle("📊 監視状況")
                .addFields(
                    {
                        name: "通知先",
                        value:
                            config.alertChannel
                                ? `<#${config.alertChannel}>`
                                : "未設定"
                    },
                    {
                        name: "参加監視",
                        value:
                            config.joinMonitor
                                ? "ON"
                                : "OFF",
                        inline: true
                    },
                    {
                        name: "新規アカウント監視",
                        value:
                            config.newAccountMonitor
                                ? `ON (${config.accountAgeDays || 10}日)`
                                : "OFF",
                        inline: true
                    },
                    {
                        name: "初期アイコン監視",
                        value:
                            config.defaultAvatarMonitor
                                ? "ON"
                                : "OFF",
                        inline: true
                    },
                    {
                        name: "リンク監視",
                        value:
                            config.linkMonitor
                                ? "ON"
                                : "OFF",
                        inline: true
                    }
                );

        await interaction.reply({
            embeds: [embed]
        });
    }
};
