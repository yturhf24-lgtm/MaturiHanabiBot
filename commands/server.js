const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType
} = require("discord.js");

const {
  checkAdmin
} = require("./utils/checkAdmin");

module.exports = {

  data: new SlashCommandBuilder()
    .setName("server")
    .setDescription("サーバー情報"),

  async execute(interaction) {

    if (!checkAdmin(interaction)) {
      return interaction.reply({
        content: "❌ 管理者専用コマンドです",
        ephemeral: true
      });
    }

    const g = interaction.guild;

    if (!g.members.cache.size) {
      await g.members.fetch();
    }

    const total = g.memberCount;

    const bots = g.members.cache.filter(m => m.user.bot).size;
    const humans = total - bots;

    const online = g.members.cache.filter(m => m.presence?.status === "online").size;
    const idle = g.members.cache.filter(m => m.presence?.status === "idle").size;
    const dnd = g.members.cache.filter(m => m.presence?.status === "dnd").size;

    const offline = g.members.cache.filter(
      m => !m.presence || m.presence.status === "offline"
    ).size;

    const text = g.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voice = g.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const category = g.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

    const roles = g.roles.cache.size - 1;

    const active = online + idle + dnd;

    const rate = total
    await interaction.reply({
      embeds: [embed]
    });

  }
};
