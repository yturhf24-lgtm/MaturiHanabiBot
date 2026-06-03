const { setGuild } = require("../utils/toggleStore");

module.exports = {
    name: "off",
    async execute(interaction) {
        setGuild(interaction.guild.id, false);

        await interaction.reply({
            content: "OFFにした",
            ephemeral: true
        });
    }
};
