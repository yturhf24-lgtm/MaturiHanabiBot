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
        .setName("avatar-monitor")
        .setDescription("初期アイコン監視")
        .addStringOption(option =>
            option
                .setName("mode")
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

        data[
            interaction.guild.id
        ].defaultAvatarMonitor =
            mode === "on";

        saveJSON(file, data);

        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("Green")
                    .setDescription(
                        `初期アイコン監視: ${mode.toUpperCase()}`
                    )
            ]
        });
    }
};
