const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-setup')
    .setDescription('認証パネルを設置します（管理者のみ）')
    // 💡 スラッシュコマンド自体を最初から「管理者のみ」に制限する（これで権限不足エラーを防げます）
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // 💡 サーバー外（DMなど）での実行をブロック
    if (!interaction.guild) {
      return interaction.reply({ content: '❌ このコマンドはサーバー内でのみ実行できます。', ephemeral: true });
    }

    // 💡 安全な権限チェック方法に修正
    if (!interaction.memberPermissions || !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ このコマンドを実行する権限（管理者権限）が不足しています。', ephemeral: true });
    }

    // --- 以下、既存のモーダル処理 ---
    const modal = new ModalBuilder()
      .setCustomId(`v_setup_modal_${interaction.guild.id}`) // 念のためguildIDを含めて安全化
      .setTitle('認証パネルの設定');

    const addRoleInput = new TextInputBuilder()
      .setCustomId('add_role_id')
      .setLabel('付与するロールID')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const removeRoleInput = new TextInputBuilder()
      .setCustomId('remove_role_id')
      .setLabel('剥奪するロールID（なければ none）')
      .setStyle(TextInputStyle.Short)
      .setValue('none')
      .setRequired(false);

    const panelTextInput = new TextInputBuilder()
      .setCustomId('panel_text')
      .setLabel('パネルに表示する説明文')
      .setStyle(TextInputStyle.Paragraph)
      .setValue('サーバーに参加するには、下の「認証」ボタンを押してセキュリティチェックを完了させてください。')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(addRoleInput),
      new ActionRowBuilder().addComponents(removeRoleInput),
      new ActionRowBuilder().addComponents(panelTextInput)
    );

    await interaction.showModal(modal);
  },
};
