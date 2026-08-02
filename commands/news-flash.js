const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('news-flash')
    .setDescription('【特別ユーザー・サーバーオーナー専用】ニュース速報の通知を設定します')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('ON または OFF')
        .setRequired(true)
        .addChoices({ name: 'ON', value: 'on' }, { name: 'OFF', value: 'off' })
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('通知を送信するチャンネル')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('mention-role')
        .setDescription('通知時にメンションするロール（任意）')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    if (interaction.user.id !== SPECIAL_USER_ID && interaction.guild?.ownerId !== interaction.user.id) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('権限がありません。')] });
    }

    const status = interaction.options.getString('status');
    const channel = interaction.options.getChannel('channel');
    const mentionRole = interaction.options.getRole('mention-role');
    const guildId = interaction.guildId;

    const settings = client.getSettings();
    if (!settings[guildId]) settings[guildId] = {};

    settings[guildId].newsFlash = {
      enabled: status === 'on',
      channelId: channel.id,
      mentionRoleId: mentionRole ? mentionRole.id : null
    };
    await client.saveSettings(settings);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(status === 'on' ? 0x00FF00 : 0xFF0000)
          .setTitle(`📰 ニュース速報通知: ${status.toUpperCase()}`)
          .setDescription(`チャンネル: <#${channel.id}>\nメンション: ${mentionRole ? `<@&${mentionRole.id}>` : 'なし'}`)
      ]
    });
  }
};
