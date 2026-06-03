const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const path = require("path");

const {
    loadJSON,
    saveJSON
} = require("../utils/jsonManager");

const checkPermission =
require("../utils/checkPermission");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("join-monitor")
        .setDescription("参加監視")
        .addStringOption(option =>
            option
                .setName("mode")
                .setDescription("on/off")
                .setRequired(true)
                .addChoices(
                    { name: "ON", value: "on" },
                    { name: "OFF", value: "off" }
                )
        ),

    async execute(interaction) {

        if (!checkPermission(interaction))
            return;

        const mode =
            interaction.options.getString(
                "mode"
            );

        const file = path.join(
            __dirname,
            "..",
            "data",
            "monitor.json"
        );

        const data = loadJSON(file);

        if (!data[interaction.guild.id])
            data[interaction.guild.id] = {};

        if (
            !data[interaction.guild.id]
                .alertChannel
        ) {

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("Red")
                        .setDescription(
                            "先に /set-alert を実行してください"
                        )
                ]
            });
        }

        data[
            interaction.guild.id
        ].joinMonitor =
            mode === "on";

        saveJSON(file, data);

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("Green")
                    .setTitle("設定完了")
                    .setDescription(
                        `参加監視: ${mode.toUpperCase()}`
                    )
            ]
        });
    }
};
