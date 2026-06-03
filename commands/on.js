const { setGuild } = require("../utils/toggleStore");

module.exports = {
    name: "on",
    async execute(interaction) {
        setGuild(interaction.guild.id, true);

        await interaction.reply({
            content: "ONにした",
            ephemeral: true
        });
    }
};
