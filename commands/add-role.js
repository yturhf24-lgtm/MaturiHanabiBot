const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('一般コマンドの実行を許可するロールを追加します（管理者専用）')
    .addRoleOption(option => option.setName('role').setDescription('許可するロールを選択').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const role = interaction.options.getRole('role');
    const guildId = interaction.guildId;
    
    const settings = interaction.client.getSettings();
    if (!settings[guildId]) {
      settings[guildId] = { roles: [] };
    }

    if (settings[guildId].roles.includes(role.id)) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFFFF00).setDescription(`ロール <@&${role.id}> は既に登録されています。`)],
        ephemeral: true
      });
    }

    settings[guildId].roles.push(role.id);
    interaction.client.saveSettings(settings);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ 許可ロール追加')
      .setDescription(`ロール <@&${role.id}> をこのサーバーの許可リストに保存しました。`)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
