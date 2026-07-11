const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-setup')
    .setDescription('認証パネルを設置します（管理者のみ）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 💡 ID入力式を完全に撤廃し、ロール選択オプションに変更
    .addRoleOption(option => 
      option.setName('target_role')
        .setDescription('認証完了時に【付与】するロールを選択してください')
        .setRequired(true)
    )
    .addRoleOption(option => 
      option.setName('remove_role')
        .setDescription('認証完了時に【剥奪】するロールを選択してください（任意）')
        .setRequired(false)
    ),

  async execute(interaction) {
    // 💡 DM実行によるクラッシュを完全に防止
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ このコマンドはサーバー内でのみ実行できます。', ephemeral: true });
    }

    // 💡 安全なプロパティから管理者権限を判定してクラッシュを回避
    if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ このコマンドを実行する権限（管理者権限）が不足しています。', ephemeral: true });
    }

    // 選択されたロールのオブジェクトからIDを抽出
    const addRole = interaction.options.getRole('target_role');
    const removeRole = interaction.options.getRole('remove_role');
    const removeRoleId = removeRole ? removeRole.id : 'none';

    // モーダルの作成（カスタムIDの末尾にロールIDを仕込んでindex.jsに引き渡す）
    const modal = new ModalBuilder()
      .setCustomId(`v_setup_modal_${addRole.id}_${removeRoleId}`)
      .setTitle('認証パネルの設定');

    const panelTextInput = new TextInputBuilder()
      .setCustomId('panel_text')
      .setLabel('パネルに表示する説明文')
      .setStyle(TextInputStyle.Paragraph)
      .setValue('サーバーに参加するには、下の「認証」ボタンを押してセキュリティチェックを完了させてください。')
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(panelTextInput));

    // モーダル画面を表示
    await interaction.showModal(modal);
  },
};
