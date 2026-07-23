const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_antilink')
    .setDescription('実行したチャンネルでの同一リンク5連投自動削除を設定します')
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
    if (!config.channels) config.channels = {};
    if (!config.channels[interaction.channelId]) config.channels[interaction.channelId] = {};

    const status = interaction.options.getBoolean('status');
    config.channels[interaction.channelId].antiLink = status;
    await client.saveSettings(allSettings);

    return interaction.reply({ 
      content: `✅ <#${interaction.channelId}> での **同一リンク5連投自動削除を ${status ? '🟢 ON' : '🔴 OFF'} に設定しました。**`, 
      flags: [MessageFlags.Ephemeral] 
    });
  }
};
