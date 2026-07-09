const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-reboot-log')
    .setDescription('Bot起動（再起動）時の通知チャンネルとON/OFFを設定します')
    .addChannelOption(option =>
      option.setName('channel').setDescription('通知を送信するテキストチャンネル').setRequired(true).addChannelTypes(ChannelType.GuildText)
    )
    .addBooleanOption(option =>
      option.setName('status').setDescription('再起動通知を有効にしますか？ (TrueでON / FalseでOFF)').setRequired(true)
    ),

  async execute(interaction) {
    // 🔐 権限チェック
    const isMasterUser = interaction.user.id === MASTER_USER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];
    const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!isMasterUser && !isAdmin && !hasAllowedRole) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('このコマンドを使用する権限がありません。')],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel');
    const status = interaction.options.getBoolean('status');

    if (!settings[interaction.guildId]) {
      settings[interaction.guildId] = { roles: [] };
    }

    // 設定データを保存
    settings[interaction.guildId].rebootChannel = channel.id;
    settings[interaction.guildId].rebootStatus = status;

    await interaction.client.saveSettings(settings);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('⚙️ 再起動通知システム設定完了')
      .setDescription('Bot起動時の通知設定を保存しました。')
      .addFields(
        { name: '📺 通知先チャンネル', value: `<#${channel.id}>`, inline: true },
        { name: '⚡ 通知ステータス', value: status ? '` ON (有効) `' : '` OFF (無効) `', inline: true }
      )
      .setTimestamp()
      .setFooter({ text: `設定変更者: ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
  },
};
