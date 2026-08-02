const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('earthquake-status')
    .setDescription('現在の地震情報・緊急地震速報・津波警報のON/OFF設定を確認します'),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const guildId = interaction.guildId;
    const settings = client.getSettings();
    const guildSettings = settings[guildId] || {};

    const eqInfo = guildSettings.earthquakeInfo;
    const emgEq = guildSettings.emergencyEarthquake;
    const tsunami = guildSettings.tsunamiWarning;

    const formatStatus = (config, title) => {
      if (!config) return `**${title}**: 未設定 (OFF)`;
      const statusText = config.enabled ? '🟢 ON' : '🔴 OFF';
      let details = `状態: ${statusText}\nチャンネル: <#${config.channelId}>\n画像添付: ${config.sendImage ? '有効' : '無効'}`;
      if (config.minScale) details += `\n最低震度: ${config.minScale}`;
      if (config.mentionRoleId) details += `\nメンション: <@&${config.mentionRoleId}>`;
      return `**${title}**\n${details}`;
    };

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📊 地震・津波通知の設定状況')
      .setDescription(
        [
          formatStatus(eqInfo, '🌍 通常地震情報'),
          '-----------------------------------',
          formatStatus(emgEq, '🚨 緊急地震速報 (EEW)'),
          '-----------------------------------',
          formatStatus(tsunami, '🌊 津波警報・注意報')
        ].join('\n\n')
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
