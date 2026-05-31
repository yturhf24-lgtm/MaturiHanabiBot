const {
  SlashCommandBuilder,
  EmbedBuilder
} = require("discord.js");

const {
  checkAdmin
} = require("../utils/checkAdmin");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("monitor")
    .setDescription("監視状態"),

  async execute(interaction) {

    if (!checkAdmin(interaction)) {
      return interaction.reply({
        content: "❌ 管理者専用",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("監視システム")
      .setDescription("正常稼働中");

    await interaction.reply({
      embeds: [embed]
    });
  }
};
