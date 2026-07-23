const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_risklog')
    .setDescription('初期アイコンや新規アカウントのリスク検知ログを設定します')
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
    config.riskLog = status;
    await client.saveSettings(allSettings);

    return interaction.reply({ 
      content: `✅ **初期アイコン・新規アカウント検知リスクログを ${status ? '🟢 ON' : '🔴 OFF'} に設定しました。**`, 
      flags: [MessageFlags.Ephemeral] 
    });
  }
};
