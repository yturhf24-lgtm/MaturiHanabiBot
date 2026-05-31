module.exports = {
    name: "interactionCreate",

    async execute(interaction) {

        if (!interaction.isChatInputCommand())
            return;

        const command =
            interaction.client.commands.get(
                interaction.commandName
            );

        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);

            if (!interaction.replied) {
                await interaction.reply({
                    content: "エラーが発生しました。",
                    ephemeral: true
                });
            }
        }
    }
};
