const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('パネル操作の条件・削除・追加ロールおよびログを設定します（所有者限定）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 条件ロール (1つのみ)
    .addRoleOption(opt => opt.setName('condition_role').setDescription('このロールを持っているか判定する条件ロール（単一）').setRequired(true))
    // ログチャンネル (任意)
    .addChannelOption(opt => opt.setName('log_channel').setDescription('ログを出力するチャンネル'))
    // 削除対象ロール (複数可能・任意)
    .addRoleOption(opt => opt.setName('remove_role1').setDescription('削除するロール 1'))
    .addRoleOption(opt => opt.setName('remove_role2').setDescription('削除するロール 2'))
    .addRoleOption(opt => opt.setName('remove_role3').setDescription('削除するロール 3'))
    // 追加対象ロール (複数可能・任意)
    .addRoleOption(opt => opt.setName('add_role1').setDescription('追加するロール 1'))
    .addRoleOption(opt => opt.setName('add_role2').setDescription('追加するロール 2'))
    .addRoleOption(opt => opt.setName('add_role3').setDescription('追加するロール 3')),

  async execute(interaction) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ このコマンドはサーバー所有者のみ実行可能です。', ephemeral: true });
    }

    const guildId = interaction.guildId;
    const conditionRole = interaction.options.getRole('condition_role');
    const logChannel = interaction.options.getChannel('log_channel');

    const removeRoles = [];
    for (let i = 1; i <= 3; i++) {
      const r = interaction.options.getRole(`remove_role${i}`);
      if (r) removeRoles.push(r.id);
    }

    const addRoles = [];
    for (let i = 1; i <= 3; i++) {
      const r = interaction.options.getRole(`add_role${i}`);
      if (r) addRoles.push(r.id);
    }

    let config = {};
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {}
    }

    config[guildId] = {
      conditionRoleId: conditionRole.id,
      logChannelId: logChannel ? logChannel.id : null,
      removeRoleIds: removeRoles,
      addRoleIds: addRoles
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

    const removeText = removeRoles.length > 0 ? removeRoles.map(id => `<@&${id}>`).join(', ') : 'なし';
    const addText = addRoles.length > 0 ? addRoles.map(id => `<@&${id}>`).join(', ') : 'なし';
    const logText = logChannel ? `<#${logChannel.id}>` : 'なし';

    await interaction.reply({
      content: `✅ **サーバー設定を保存しました**\n` +
               `・条件ロール: <@&${conditionRole.id}>\n` +
               `・削除対象: ${removeText}\n` +
               `・追加対象: ${addText}\n` +
               `・ログチャンネル: ${logText}`,
      ephemeral: true
    });
  }
};
