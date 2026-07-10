const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-log')
    .setDescription('認証詳細ログの設定を行います')
    .addChannelOption(option => option.setName('channel').setDescription('ログを送信するチャンネル').setRequired(true))
    .addStringOption(option => option.setName('status').setDescription('オンかオフを選択').setRequired(true).addChoices(
      { name: 'ON', value: 'on' },
      { name: 'OFF', value: 'off' }
    )),

  async execute(interaction) {
    const isMasterUser = interaction.user.id === MASTER_USER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];
    const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!isMasterUser && !isAdmin && !hasAllowedRole) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('このコマンドを使用する権限がありません。')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const channel = interaction.options.getChannel('channel');
    const status = interaction.options.getString('status');

    if (!settings[interaction.guildId]) settings[interaction.guildId] = { roles: [] };
    
    settings[interaction.guildId].vLogChannel = channel.id;
    settings[interaction.guildId].vLogStatus = (status === 'on');
    await interaction.client.saveSettings(settings);

    await interaction.reply({
      content: `✅ 認証ログを <#${channel.id}> で **${status.toUpperCase()}** に設定しました。`,
      flags: [MessageFlags.Ephemeral]
    });
  },
};
