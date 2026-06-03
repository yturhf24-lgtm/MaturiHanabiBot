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
        .setName("account-monitor")
        .setDescription("新規アカウント監視")
        .addStringOption(option =>
            option
                .setName("mode")
                .setRequired(true)
                .addChoices(
                    { name: "ON", value: "on" },
                    { name: "OFF", value: "off" }
                )
        )
        .addIntegerOption(option =>
            option
                .setName("days")
                .setDescription("日数")
        ),

    async execute(interaction) {

        if (!checkPermission(interaction))
            return;

        const mode =
            interaction.options.getString(
                "mode"
            );

        const days =
            interaction.options.getInteger(
                "days"
            ) || 10;

        const file = path.join(
            __dirname,
            "..",
            "data",
            "monitor.json"
        );

        const data = loadJSON(file);

        if (!data[interaction.guild.id])
            data[interaction.guild.id] = {};

        data[
            interaction.guild.id
        ].newAccountMonitor =
            mode === "on";

        data[
            interaction.guild.id
        ].accountAgeDays =
            days;

        saveJSON(file, data);

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("Green")
                    .setDescription(
                        `新規アカウント監視: ${mode.toUpperCase()}\n日数: ${days}`
                    )
            ]
        });
    }
};
