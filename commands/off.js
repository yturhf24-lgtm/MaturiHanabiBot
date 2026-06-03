const { SlashCommandBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("off")
        .setDescription("OFFにする"),

    async execute(interaction) {
        await interaction.reply({
            content: "OFF",
            ephemeral: true
        });
    }
};
