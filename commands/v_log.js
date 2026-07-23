const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_log')
    .setDescription('実行したチャンネルへログを出力するように設定します')
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
    config.vLogStatus = status;
    config.vLogChannel = interaction.channelId;
    await client.saveSettings(allSettings);

    return interaction.reply({ 
      content: `✅ **ログ出力機能を ${status ? '🟢 ON' : '🔴 OFF'} に設定しました。** (出力先: <#${interaction.channelId}>)`, 
      flags: [MessageFlags.Ephemeral] 
    });
  }
};
