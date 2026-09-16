const { 
  SlashCommandBuilder, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle, 
  ActionRowBuilder 
} = require('discord.js');

const ALLOWED_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('【管理者限定】全サーバーにアナウンスを送信します'),

  async execute(interaction) {
    if (interaction.user.id !== ALLOWED_USER_ID) {
      return interaction.reply({ content: '❌ このコマンドを実行する権限がありません。', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('announce_modal')
      .setTitle('📢 全サーバーアナウンス作成');

    const titleInput = new TextInputBuilder()
      .setCustomId('announce_title')
      .setLabel('アナウンスのタイトル')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const bodyInput = new TextInputBuilder()
      .setCustomId('announce_body')
      .setLabel('アナウンスの内容')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(bodyInput)
    );

    await interaction.showModal(modal);
  }
};
