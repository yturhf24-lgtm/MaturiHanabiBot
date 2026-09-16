const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const ALLOWED_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servers')
    .setDescription('【管理者限定】Botが導入されている全サーバーを確認します'),

  async execute(interaction) {
    if (interaction.user.id !== ALLOWED_USER_ID) {
      return interaction.reply({ content: '❌ このコマンドを実行する権限がありません。', ephemeral: true });
    }

    const guilds = interaction.client.guilds.cache;
    let description = `現在 **${guilds.size}** 個のサーバーに導入されています。\n\n`;

    guilds.forEach(guild => {
      description += `・ **${guild.name}** (ID: \`${guild.id}\` | メンバー数: ${guild.memberCount})\n`;
    });

    if (description.length > 4000) {
      description = description.substring(0, 3900) + '\n...（省略されました）';
    }

    const embed = new EmbedBuilder()
      .setTitle('🌐 導入サーバー一覧')
      .setColor('#3498db')
      .setDescription(description)
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
