const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-roles')
    .setDescription('現在登録されている許可ロールの一覧を表示します（管理者専用）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[guildId]?.roles || [];

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📋 許可ロール一覧')
      .setTimestamp();

    if (allowedRoles.length === 0) {
      embed.setDescription('現在、登録されている許可ロールはありません。\n（現在はサーバー管理者のみがコマンドを実行できます）');
    } else {
      const roleMentions = allowedRoles.map(id => `・ <@&${id}> (ID: ${id})`).join('\n');
      embed.setDescription(`以下のロールを持つメンバーは、管理者以外でも制限されたコマンドを実行できます：\n\n${roleMentions}`);
    }

    await interaction.reply({ embeds: [embed] });
  },
};
