const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('earthquake-status')
    .setDescription('地震・津波・天気予報・ニュース・避難情報のON/OFFおよび設定状況を一括確認します'),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const guildId = interaction.guildId;
    const settings = client.getSettings();
    const guildSettings = settings[guildId] || {};

    const eqInfo = guildSettings.earthquakeInfo;
    const emgEq = guildSettings.emergencyEarthquake;
    const tsunami = guildSettings.tsunamiWarning;
    const weather = guildSettings.weatherForecast;
    const news = guildSettings.newsFlash;
    const evacuation = guildSettings.evacuationInfo;

    const formatStatus = (config, title) => {
      if (!config) return `**${title}**: 未設定 (OFF)`;
      const statusText = config.enabled ? '🟢 ON' : '🔴 OFF';
      let details = `状態: ${statusText}\nチャンネル: <#${config.channelId}>`;
      if (config.region) details += `\n対象地域: ${config.region}`;
      if (config.minScale) details += `\n最低震度: ${config.minScale}`;
      if (config.sendImage !== undefined) details += `\n画像添付: ${config.sendImage ? '有効' : '無効'}`;
      if (config.mentionRoleId) details += `\nメンション: <@&${config.mentionRoleId}>`;
      return `**${title}**\n${details}`;
    };

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📊 防災・速報・天気通知の設定状況')
      .setDescription(
        [
          formatStatus(eqInfo, '🌍 通常地震情報'),
          formatStatus(emgEq, '🚨 緊急地震速報 (EEW)'),
          formatStatus(tsunami, '🌊 津波警報・注意報'),
          formatStatus(weather, '☀️ 全国の天気予報'),
          formatStatus(news, '📰 ニュース速報'),
          formatStatus(evacuation, '🚨 避難情報')
        ].join('\n-----------------------------------\n')
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};
