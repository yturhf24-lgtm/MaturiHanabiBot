const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setroles')
    .setDescription('削除対象のロールを設定します（サーバー所有者限定）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addRoleOption(opt => opt.setName('role1').setDescription('ロール 1').setRequired(true))
    .addRoleOption(opt => opt.setName('role2').setDescription('ロール 2'))
    .addRoleOption(opt => opt.setName('role3').setDescription('ロール 3'))
    .addRoleOption(opt => opt.setName('role4').setDescription('ロール 4'))
    .addRoleOption(opt => opt.setName('role5').setDescription('ロール 5')),

  async execute(interaction) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ このコマンドはサーバー所有者のみ実行可能です。', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const roles = [];
    for (let i = 1; i <= 5; i++) {
      const role = interaction.options.getRole(`role${i}`);
      if (role) roles.push(role.id);
    }

    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (!config[guildId]) config[guildId] = {};
    config[guildId].removeRoleIds = roles;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const roleMentions = roles.map(id => `<@&${id}>`).join(', ');
    await interaction.reply({ content: `✅ 削除対象ロールを設定しました: ${roleMentions}`, ephemeral: true });
  }
};
