const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-join')
    .setDescription('このチャンネルに参加ログを設定するポップアップ画面UIを開きます'),

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
    const currentJoinMsg = config.joinMessage || '**{user}** がサーバーに参加しました！';

    const modal = new ModalBuilder()
      .setCustomId('join_msg_modal')
      .setTitle('📥 参加ログの編集（このチャンネルに設定）');

    const joinInput = new TextInputBuilder()
      .setCustomId('modal_join_text_input')
      .setLabel('参加テンプレートを入力 ({user}でメンション)')
      .setStyle(TextInputStyle.Paragraph)
      .setValue(currentJoinMsg)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(joinInput));
    await interaction.showModal(modal);
  },
};
