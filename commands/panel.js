const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('操作用パネルを生成します（サーバー所有者限定）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ このコマンドはサーバー所有者のみ実行可能です。', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('ロール削除管理パネル')
      .setDescription('下のボタンを押すと、このサーバーで設定されているロールがアカウントから削除されます。')
      .setColor(0x00ff00);

    const button = new ButtonBuilder()
      .setCustomId('remove_roles_button')
      .setLabel('指定ロールを削除')
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(button);
    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
