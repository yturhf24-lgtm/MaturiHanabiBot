const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_antispam')
    .setDescription('サーバー全体の連投スパム対策を設定します')
    .addBooleanOption(option =>
      option.setName('status')
        .setDescription('ON または OFF')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    if (!client.isAuthorizedUser(interaction)) {
      return interaction.reply({ content: '❌ **このコマンドを実行する権限がありません。**', flags: [MessageFlags.Ephemeral] });
    }

    const allSettings = client.getSettings();
    if (!allSettings[interaction.guildId]) allSettings[interaction.guildId] = {};
    const config = allSettings[interaction.guildId];

    const status = interaction.options.getBoolean('status');
    config.antiSpam = status; // サーバー全体に適用
    await client.saveSettings(allSettings);

    return interaction.reply({ 
      content: `✅ **サーバー全体の 簡易スパム対策を ${status ? '🟢 ON' : '🔴 OFF'} に設定しました。**（新規チャンネル含む）`, 
      flags: [MessageFlags.Ephemeral] 
    });
  }
};
