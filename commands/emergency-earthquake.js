const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('emergency-earthquake')
    .setDescription('【特別ユーザー・サーバーオーナー専用】緊急地震速報（EEW）を設定します')
    // 必須オプション
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
    .addStringOption(option =>
      option.setName('min-scale')
        .setDescription('予測される最低震度')
        .setRequired(true)
        .addChoices(
          { name: '震度1以上', value: '1' },
          { name: '震度3以上', value: '3' },
          { name: '震度4以上', value: '4' },
          { name: '震度5弱以上', value: '5lower' }
        )
    )
    .addStringOption(option =>
      option.setName('send-image')
        .setDescription('速報マップ画像を添付するかどうか')
        .setRequired(true)
        .addChoices({ name: '画像を添付する', value: 'yes' }, { name: '添付しない', value: 'no' })
    )
    // 任意オプション
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
    const minScale = interaction.options.getString('min-scale');
    const sendImage = interaction.options.getString('send-image') === 'yes';
    const mentionRole = interaction.options.getRole('mention-role');
    const guildId = interaction.guildId;

    const settings = client.getSettings();
    if (!settings[guildId]) settings[guildId] = {};

    settings[guildId].emergencyEarthquake = {
      enabled: status === 'on',
      channelId: channel.id,
      minScale,
      sendImage,
      mentionRoleId: mentionRole ? mentionRole.id : null
    };
    await client.saveSettings(settings);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(status === 'on' ? 0x00FF00 : 0xFF0000)
          .setTitle(`🚨 緊急地震速報(EEW): ${status.toUpperCase()}`)
          .setDescription(`チャンネル: <#${channel.id}>\n対象震度: ${minScale}\n画像添付: ${sendImage ? '有効' : '無効'}\nメンション: ${mentionRole ? `<@&${mentionRole.id}>` : 'なし'}`)
      ]
    });
  }
};
