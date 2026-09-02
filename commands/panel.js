const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('ロール更新の設定を行い、埋め込みパネルを生成します（所有者限定）')
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

    // ローカルへ設定書き込み
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

    // 埋め込み式パネル (Embed) の作成
    const embed = new EmbedBuilder()
      .setTitle('🛡️ ロール自動更新・管理パネル')
      .setDescription('下のボタンを押すことで、手動でロール状態のチェックと更新を実行できます。\n（※Bot側で**5分ごと**に自動監視・更新処理も行われています）')
      .setColor(0x3498db)
      .addFields(
        { name: '🔹 条件判定ロール', value: `<@&${conditionRole.id}>`, inline: false },
        { name: '🗑️ 削除対象ロール', value: removeRoles.length > 0 ? removeRoles.map(id => `<@&${id}>`).join(', ') : 'なし', inline: true },
        { name: '➕ 追加対象ロール', value: addRoles.length > 0 ? addRoles.map(id => `<@&${id}>`).join(', ') : 'なし', inline: true },
        { name: '📜 ログ送信先', value: logChannel ? `<#${logChannel.id}>` : 'なし', inline: false }
      )
      .setFooter({ text: 'サーバー所有者専用管理機能' })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('process_roles_button')
      .setLabel('ロール更新を手動実行')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    // 埋め込みパネルを返信
    await interaction.reply({ embeds: [embed], components: [row] });
  }
};
