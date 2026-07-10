const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-setup')
    .setDescription('Web認証パネルを設置します')
    .addRoleOption(option => option.setName('add_role').setDescription('認証成功時に付与するロール').setRequired(true))
    .addRoleOption(option => option.setName('remove_role').setDescription('認証成功時に削除するロール（任意）').setRequired(false)),

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

    const addRole = interaction.options.getRole('add_role');
    const removeRole = interaction.options.getRole('remove_role');

    // 一時的にロールデータをモーダルのカスタムIDに埋め込む
    const modal = new ModalBuilder()
      .setCustomId(`v_setup_modal_${addRole.id}_${removeRole ? removeRole.id : 'none'}`)
      .setTitle('🔒 認証パネルの作成');

    const textInput = new TextInputBuilder()
      .setCustomId('panel_text')
      .setLabel('パネルに表示する案内文を入力してください')
      .setStyle(TextInputStyle.Paragraph)
      .setValue('サーバーに参加するには、下の「認証」ボタンを押してウェブサイト連携を行ってください。')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
    await interaction.showModal(modal);
  },
};
