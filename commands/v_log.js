const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_log')
    .setDescription('全ログの出力チャンネルと有効/無効を設定します。')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt => opt.setName('channel').setDescription('ログを出力するチャンネル').setRequired(true))
    .addBooleanOption(opt => opt.setName('status').setDescription('ログの有効(true)/無効(false)').setRequired(true)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const status = interaction.options.getBoolean('status');
    const guildId = interaction.guildId;
    const client = interaction.client;

    const allSettings = client.getSettings();
    if (!allSettings[guildId]) allSettings[guildId] = {};

    allSettings[guildId].vLogChannel = channel.id;
    allSettings[guildId].vLogStatus = status;

    await client.saveSettings(allSettings);

    return interaction.reply({ content: `📜 ログ設定を更新しました:\n・**チャンネル:** <#${channel.id}>\n・**ステータス:** ${status ? 'ON' : 'OFF'}`, ephemeral: true });
  }
};
