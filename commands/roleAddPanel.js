const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  RoleSelectMenuBuilder, 
  ChannelSelectMenuBuilder,
  ChannelType,
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  MessageFlags 
} = require('discord.js');

function buildRoleAddPanelEmbed(guild, config) {
  const c = config[guild.id]?.addRoleConfig || {};

  const enabledStr = c.enabled ? '🟢 動作中' : '🔴 停止中';
  
  const checkRolesStr = (c.checkRoleIds && c.checkRoleIds.length > 0)
    ? c.checkRoleIds.map(id => `<@&${id}>`).join(', ')
    : 'なし（全員対象）';

  const addRolesStr = (c.addRoleIds && c.addRoleIds.length > 0)
    ? c.addRoleIds.map(id => `<@&${id}>`).join(', ')
    : '未設定';

  const logChannelStr = c.logChannelId ? `<#${c.logChannelId}>` : '未設定';

  return new EmbedBuilder()
    .setTitle('➕ ロール条件付与パネル')
    .setDescription(
      '【対象条件】\n' +
      '設定した**「未所持チェックロール」を1つも持っていない**メンバーに対し、**「付与ロール」**を自動付与します。'
    )
    .setColor(c.enabled ? 0x00ff00 : 0xff0000)
    .addFields(
      { name: '⚡ 機能ステータス', value: enabledStr, inline: false },
      { name: '❓ 未所持チェックロール (これが無い人に対象)', value: checkRolesStr, inline: false },
      { name: '➕ 付与するロール (自動追加)', value: addRolesStr, inline: false },
      { name: '📜 ログ出力チャンネル', value: logChannelStr, inline: false }
    )
    .setFooter({ text: '※この操作パネルはあなただけに表示されています' })
    .setTimestamp();
}

function buildRoleAddPanelComponents(guild, config) {
  const c = config[guild.id]?.addRoleConfig || {};

  const checkRoleMenu = new RoleSelectMenuBuilder()
    .setCustomId('select_add_check_roles')
    .setPlaceholder('持っていないことを確認するロールを選択 (複数可)')
    .setMinValues(0)
    .setMaxValues(10);
  if (c.checkRoleIds && c.checkRoleIds.length > 0) checkRoleMenu.setDefaultRoles(c.checkRoleIds);

  const addRoleMenu = new RoleSelectMenuBuilder()
    .setCustomId('select_add_target_roles')
    .setPlaceholder('付与するロールを選択 (複数可)')
    .setMinValues(0)
    .setMaxValues(10);
  if (c.addRoleIds && c.addRoleIds.length > 0) addRoleMenu.setDefaultRoles(c.addRoleIds);

  const logChannelMenu = new ChannelSelectMenuBuilder()
    .setCustomId('select_add_role_log_channel')
    .setPlaceholder('ログ送信先のテキストチャンネルを選択')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (c.logChannelId) logChannelMenu.setDefaultChannels([c.logChannelId]);

  const toggleButton = new ButtonBuilder()
    .setCustomId('toggle_role_add_active')
    .setLabel(c.enabled ? '⏹️ 機能を停止' : '▶️ 機能を開始')
    .setStyle(c.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  return [
    new ActionRowBuilder().addComponents(checkRoleMenu),
    new ActionRowBuilder().addComponents(addRoleMenu),
    new ActionRowBuilder().addComponents(logChannelMenu),
    new ActionRowBuilder().addComponents(toggleButton)
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role-add-panel')
    .setDescription('ロール非所持者への自動ロール付与パネルを開きます')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  buildRoleAddPanelEmbed,
  buildRoleAddPanelComponents,

  async execute(interaction, globalConfig = {}) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ このパネルはサーバー所有者しか開けません。', flags: MessageFlags.Ephemeral });
    }

    const embed = buildRoleAddPanelEmbed(interaction.guild, globalConfig);
    const components = buildRoleAddPanelComponents(interaction.guild, globalConfig);

    await interaction.reply({ embeds: [embed], components: components, flags: MessageFlags.Ephemeral });
  }
};
