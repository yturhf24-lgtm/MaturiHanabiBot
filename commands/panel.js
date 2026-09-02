const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('ロール更新の設定を行い、実行用パネルを生成します（サーバー所有者限定）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 条件ロール (単一・必須)
    .addRoleOption(opt => opt.setName('condition_role').setDescription('保有を確認する条件ロール（1つのみ）').setRequired(true))
    // 削除対象ロール (複数可能・任意)
    .addRoleOption(opt => opt.setName('remove_role1').setDescription('削除するロール 1'))
    .addRoleOption(opt => opt.setName('remove_role2').setDescription('削除するロール 2'))
    .addRoleOption(opt => opt.setName('remove_role3').setDescription('削除するロール 3'))
    // 追加対象ロール (複数可能・任意)
    .addRoleOption(opt => opt.setName('add_role1').setDescription('追加するロール 1'))
    .addRoleOption(opt => opt.setName('add_role2').setDescription('追加するロール 2'))
    .addRoleOption(opt => opt.setName('add_role3').setDescription('追加するロール 3'))
    // ログチャンネル (任意)
    .addChannelOption(opt => opt.setName('log_channel').setDescription('実行結果を出力するログチャンネル')),

  async execute(interaction, saveConfigToGithub) {
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

    // ローカルに設定を書き込み
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

    // GitHubへ直接保存
    if (saveConfigToGithub) {
      await saveConfigToGithub();
    }

    // パネルメッセージの構築
    const embed = new EmbedBuilder()
      .setTitle('ロール更新管理パネル')
      .setDescription(
        `下のボタンを押すとロールの自動更新処理を実行します。\n\n` +
        `**【設定情報】**\n` +
        `・条件ロール: <@&${conditionRole.id}>\n` +
        `・削除対象: ${removeRoles.length > 0 ? removeRoles.map(id => `<@&${id}>`).join(', ') : 'なし'}\n` +
        `・追加対象: ${addRoles.length > 0 ? addRoles.map(id => `<@&${id}>`).join(', ') : 'なし'}\n` +
        `・ログ出力先: ${logChannel ? `<#${logChannel.id}>` : 'なし'}`
      )
      .setColor(0x001f3f);

    const button = new ButtonBuilder()
      .setCustomId('process_roles_button')
      .setLabel('ロール更新を実行')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
