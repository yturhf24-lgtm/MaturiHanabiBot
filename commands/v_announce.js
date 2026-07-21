const { SlashCommandBuilder, PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_announce')
    .setDescription('UIモーダルを使って埋め込みアナウンスを作成・送信します。')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const modal = new ModalBuilder()
      .setCustomId('announce_modal')
      .setTitle('📢 埋め込みアナウンス作成');

    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel('タイトル')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const contentInput = new TextInputBuilder()
      .setCustomId('content')
      .setLabel('本文')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(contentInput)
    );

    await interaction.showModal(modal);
  }
};
