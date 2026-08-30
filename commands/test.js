const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('test').setDescription('動作確認'),
  async execute(i) {
    await i.deferReply({ ephemeral: true }); // 🔒 自分だけに表示
    await i.editReply({
      embeds: [new EmbedBuilder().setColor('Green').setTitle('✅ 成功！').setDescription('Botは正常に動いています！')]
    });
  }
};
