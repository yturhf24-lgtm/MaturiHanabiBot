const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reset-log')
    .setDescription('ログ通知設定をすべて初期化・解除します'),

  async execute(interaction) {
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

    if (!settings[interaction.guildId] || !settings[interaction.guildId].logChannel) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFFFF00).setDescription('現在、設定されているログ通知はありません。')]
      });
    }

    settings[interaction.guildId].logChannel = null;
    settings[interaction.guildId].joinMessage = null;
    settings[interaction.guildId].leaveMessage = null;
    await interaction.client.saveSettings(settings);

    await interaction.editReply({
      embeds: [new EmbedBuilder().setColor(0x00FF00).setTitle('🗑️ 設定解除完了').setDescription('参加・退出ログ設定をクリアしました。')]
    });
  },
};
