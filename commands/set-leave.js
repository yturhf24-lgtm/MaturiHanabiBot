const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-leave')
    .setDescription('退出メッセージを編集するポップアップ画面UIを開きます'),

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

    const config = settings[interaction.guildId] || {};
    const currentLeaveMsg = config.leaveMessage || '**{user}** がサーバーから退出しました。';

    const modal = new ModalBuilder()
      .setCustomId('leave_msg_modal')
      .setTitle('📤 退出メッセージの編集UI');

    const leaveInput = new TextInputBuilder()
      .setCustomId('modal_leave_input')
      .setLabel('退出テンプレートを入力 ({user}でメンション)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(currentLeaveMsg)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(leaveInput));
    await interaction.showModal(modal);
  },
};
