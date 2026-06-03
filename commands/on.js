const { SlashCommandBuilder } = require("discord.js");
const { setGuild } = require("../utils/toggleStore");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("on")
        .setDescription("サーバー機能をONにする"),

    async execute(interaction) {
        setGuild(interaction.guild.id, true);

        await interaction.reply({
            content: "ONにしました",
            ephemeral: true
        });
    }
};
