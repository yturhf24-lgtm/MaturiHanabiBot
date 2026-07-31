const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('restart-notify')
    .setDescription('【特別ユーザー・サーバーオーナー専用】Botの起動・再起動通知を設定します')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('ON または OFF を選択')
        .setRequired(true)
        .addChoices(
          { name: 'ON', value: 'on' },
          { name: 'OFF', value: 'off' }
        )
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('通知を送信するチャンネル（ONの時のみ必須）')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('mention')
        .setDescription('通知時にメンションする対象（任意）')
        .setRequired(false)
        .addChoices(
          { name: '@everyone', value: '@everyone' },
          { name: '@here', value: '@here' }
        )
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    // 権限チェック
    const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
    const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;

    if (!isSpecialUser && !isGuildOwner) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 権限エラー')
            .setDescription('このコマンドはサーバーの所有者または指定されたプレイヤーのみ実行可能です。')
        ]
      });
    }

    const status = interaction.options.getString('status');
    const channel = interaction.options.getChannel('channel');
    const mention = interaction.options.getString('mention') || 'なし';
    const guildId = interaction.guildId;

    if (status === 'on' && !channel) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('⚠️ 設定エラー')
            .setDescription('通知をONにする場合は、送信先のチャンネルを指定してください。')
        ]
      });
    }

    const settings = client.getSettings();
    if (!settings[guildId]) {
      settings[guildId] = {};
    }

    if (status === 'on') {
      settings[guildId].restartNotify = {
        enabled: true,
        channelId: channel.id,
        mention: mention
      };
      await client.saveSettings(settings);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🔔 再起動通知設定: ON')
            .setDescription(`再起動・アップデート時の通知を有効化しました。\n\n・送信先: <#${channel.id}>\n・メンション: ${mention}`)
        ]
      });
    } else {
      settings[guildId].restartNotify = {
        enabled: false,
        channelId: null,
        mention: 'なし'
      };
      await client.saveSettings(settings);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🔔 再起動通知設定: OFF')
            .setDescription('再起動・アップデート時の通知を無効化しました。')
        ]
      });
    }
  }
};
