const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  EmbedBuilder, 
  ChannelType 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('ロール削除パネルを生成します（サーバー所有者限定）')
    .addRoleOption(option => 
      option.setName('role1').setDescription('削除対象ロール 1').setRequired(true))
    .addChannelOption(option => 
      option.setName('log_channel').setDescription('ログを出力するテキストチャンネル').addChannelTypes(ChannelType.GuildText))
    .addRoleOption(option => 
      option.setName('role2').setDescription('削除対象ロール 2'))
    .addRoleOption(option => 
      option.setName('role3').setDescription('削除対象ロール 3'))
    .addRoleOption(option => 
      option.setName('role4').setDescription('削除対象ロール 4'))
    .addRoleOption(option => 
      option.setName('role5').setDescription('削除対象ロール 5')),

  async execute(interaction) {
    // サーバー所有者以外の実行を拒否
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ 
        content: '⚠️ このコマンドはサーバー所有者のみ実行可能です。', 
        ephemeral: true 
      });
    }

    const roles = [];
    for (let i = 1; i <= 5; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) roles.push(role);
    }

    const logChannel = interaction.options.getChannel('log_channel');
    const logChannelId = logChannel ? logChannel.id : 'none';

    const embed = new EmbedBuilder()
      .setTitle('🛡️ ロール削除パネル')
      .setDescription('自身から削除したいロールを以下のメニューから選択してください。')
      .setColor(0x00aaff);

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`remove_roles_menu_${logChannelId}`)
      .setPlaceholder('削除したいロールを選択...')
      .setMinValues(1)
      .setMaxValues(roles.length)
      .addOptions(
        roles.map(r => ({
          label: r.name,
          value: r.id,
          description: `ID: ${r.id}`
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
