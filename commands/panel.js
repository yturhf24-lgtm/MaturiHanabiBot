const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('ロール操作実行パネルを生成します（サーバー所有者限定）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ このコマンドはサーバー所有者のみ実行可能です。', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('ロール更新パネル')
      .setDescription('下のボタンを押すと設定された条件ロールの保有状況を確認し、ロールの変更処理を実行します。')
      .setColor(0x3498db);

    const button = new ButtonBuilder()
      .setCustomId('process_roles_button')
      .setLabel('ロール更新を実行')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);
    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
