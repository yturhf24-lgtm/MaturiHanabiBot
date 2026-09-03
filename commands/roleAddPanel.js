const { SlashCommandBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

function buildRoleAddPanelEmbed(guild, config) {
  const c = config[guild.id]?.addRoleConfig || {};

  const excludeStr = (c.excludeRoleIds && c.excludeRoleIds.length > 0) ? c.excludeRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし（全員対象）';
  const targetStr = (c.targetRoleIds && c.targetRoleIds.length > 0) ? c.targetRoleIds.map(id => `<@&${id}>`).join(', ') : '未設定（選択必須）';
  const logStr = c.logChannelId ? `<#${c.logChannelId}>` : '未設定（なしでもOK）';
  const statusStr = c.enabled ? '🟢 動作中（5分ごとに自動チェック）' : '🔴 停止中';

  return new EmbedBuilder()
    .setTitle('➕ 条件ロール自動付与パネル')
    .setDescription(
      '設定した**除外ロール以外の全員**を対象に、自動でロールを付与します。'
    )
    .setColor(c.enabled ? 0x00ff00 : 0xff0000)
    .addFields(
      { name: '⚡ 現在の動作ステータス', value: statusStr, inline: false },
      { name: '🚫 1. 除外ロール（このロール以外が自動付与の対象）', value: excludeStr, inline: false },
      { name: '➕ 2. 付与するロール（自動でつける役職）', value: targetStr, inline: false },
      { name: '📜 3. ログ送信先チャンネル', value: logStr, inline: false }
    )
    .setFooter({ text: '※この操作パネルはあなただけに表示されています' })
    .setTimestamp();
}

function buildRoleAddPanelComponents(guild, config) {
  const c = config[guild.id]?.addRoleConfig || {};

  const excludeMenuBuilder = new RoleSelectMenuBuilder()
    .setCustomId('select_add_exclude_roles')
    .setPlaceholder('1. 除外するロールを選ぶ（これ以外の人に付与）')
    .setMinValues(0)
    .setMaxValues(10);
  if (c.excludeRoleIds && c.excludeRoleIds.length > 0) excludeMenuBuilder.setDefaultRoles(c.excludeRoleIds);

  const targetMenuBuilder = new RoleSelectMenuBuilder()
    .setCustomId('select_add_target_roles')
    .setPlaceholder('2. 自動で付与するロールを選ぶ')
    .setMinValues(0)
    .setMaxValues(10);
  if (c.targetRoleIds && c.targetRoleIds.length > 0) targetMenuBuilder.setDefaultRoles(c.targetRoleIds);

  const channelMenuBuilder = new ChannelSelectMenuBuilder()
    .setCustomId('select_add_role_log_channel')
    .setPlaceholder('3. ログを送るチャンネルを選ぶ（なしでもOK）')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (c.logChannelId) channelMenuBuilder.setDefaultChannels([c.logChannelId]);

  const toggleButton = new ButtonBuilder()
    .setCustomId('toggle_role_add_active')
    .setLabel(c.enabled ? '⏹️ 自動付与を停止する' : '▶️ 自動付与を開始する')
    .setStyle(c.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  return [
    new ActionRowBuilder().addComponents(excludeMenuBuilder),
    new ActionRowBuilder().addComponents(targetMenuBuilder),
    new ActionRowBuilder().addComponents(channelMenuBuilder),
    new ActionRowBuilder().addComponents(toggleButton)
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleaddpanel')
    .setDescription('条件ロール自動付与の設定パネルを開きます')
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
