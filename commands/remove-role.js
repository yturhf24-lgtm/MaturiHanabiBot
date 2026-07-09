const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-role')
    .setDescription('許可リストから特定のロールを削除します（管理者専用）')
    .addRoleOption(option => option.setName('role').setDescription('削除するロールを選択').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const guildId = interaction.guildId;
    
    const settings = interaction.client.getSettings();
    
    if (!settings[guildId] || !settings[guildId].roles.includes(role.id)) {
      return interaction.reply({
        embeds: [new Builder().setColor(0xFF0000).setDescription(`ロール <@&${role.id}> は登録されていません。`)],
        ephemeral: true
      });
    }

    settings[guildId].roles = settings[guildId].roles.filter(id => id !== role.id);
    interaction.client.saveSettings(settings);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ 許可ロール削除')
      .setDescription(`ロール <@&${role.id}> をこのサーバーの許可リストから削除しました。`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
