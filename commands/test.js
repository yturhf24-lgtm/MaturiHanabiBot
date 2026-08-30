const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('test').setDescription('テストコマンド'),
  async execute(i) {
    const e = new EmbedBuilder()
      .setColor('Green')
      .setTitle('✅ 動いてる！')
      .setDescription('Botは正常に動作しています！');
    await i.reply({ embeds: [e] });
  }
};
