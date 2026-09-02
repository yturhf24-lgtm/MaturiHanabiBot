const { SlashCommandBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

// パネル用のEmbedメッセージを生成
function buildPanelEmbed(guild, config) {
  const c = config[guild.id] || {};
  
  const conditionStr = c.conditionRoleId ? `<@&${c.conditionRoleId}>` : '未設定（選択必須）';
  const removeStr = (c.removeRoleIds && c.removeRoleIds.length > 0) ? c.removeRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし';
  const addStr = (c.addRoleIds && c.addRoleIds.length > 0) ? c.addRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし';
  const logStr = c.logChannelId ? `<#${c.logChannelId}>` : '未設定（なしでもOK）';
  const statusStr = c.enabled ? '🟢 動作中（10秒ごとに自動チェック）' : '🔴 停止中';

  return new EmbedBuilder()
    .setTitle('🛡️ ロール自動制御パネル')
    .setDescription(
      '下のメニューから対象の役職や設定を選択してください。\n' +
      '設定した内容は自動保存されます。'
    )
    .setColor(c.enabled ? 0x00ff00 : 0xff0000)
    .addFields(
      { name: '⚡ 現在の動作ステータス', value: statusStr, inline: false },
      { name: '🔍 1. チェックするロール（この役職を持っている人だけ処理）', value: conditionStr, inline: false },
      { name: '🗑️ 2. 自動で外すロール', value: removeStr, inline: true },
      { name: '➕ 3. 自動でつけるロール', value: addStr, inline: true },
      { name: '📜 4. ログ送信先チャンネル', value: logStr, inline: false }
    )
    .setFooter({ text: '※この操作パネルはあなただけに表示されています' })
    .setTimestamp();
}

// パネルの操作用メニューを生成（保存済み設定を初期値としてセット）
function buildPanelComponents(guild, config) {
  const c = config[guild.id] || {};

  // 1. チェック対象ロール選択
  const conditionMenuBuilder = new RoleSelectMenuBuilder()
    .setCustomId('select_condition_role')
    .setPlaceholder('1. チェックするロールを選ぶ（1つ選択）')
    .setMinValues(1)
    .setMaxValues(1);
  if (c.conditionRoleId) conditionMenuBuilder.setDefaultRoles([c.conditionRoleId]);

  // 2. 削除対象ロール選択
  const removeMenuBuilder = new RoleSelectMenuBuilder()
    .setCustomId('select_remove_roles')
    .setPlaceholder('2. 自動で外したいロールを選ぶ（複数選択可）')
    .setMinValues(0)
    .setMaxValues(10);
  if (c.removeRoleIds && c.removeRoleIds.length > 0) removeMenuBuilder.setDefaultRoles(c.removeRoleIds);

  // 3. 付与対象ロール選択
  const addMenuBuilder = new RoleSelectMenuBuilder()
    .setCustomId('select_add_roles')
    .setPlaceholder('3. 自動でつけたいロールを選ぶ（複数選択可）')
    .setMinValues(0)
    .setMaxValues(10);
  if (c.addRoleIds && c.addRoleIds.length > 0) addMenuBuilder.setDefaultRoles(c.addRoleIds);

  // 4. ログチャンネル選択
  const channelMenuBuilder = new ChannelSelectMenuBuilder()
    .setCustomId('select_log_channel')
    .setPlaceholder('4. ログを送るチャンネルを選ぶ（なしでもOK）')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (c.logChannelId) channelMenuBuilder.setDefaultChannels([c.logChannelId]);

  // 5. 開始 / 停止 ボタン
  const toggleButton = new ButtonBuilder()
    .setCustomId('toggle_active_button')
    .setLabel(c.enabled ? '⏹️ 監視を停止する' : '▶️ 監視を開始する')
    .setStyle(c.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  return [
    new ActionRowBuilder().addComponents(conditionMenuBuilder),
    new ActionRowBuilder().addComponents(removeMenuBuilder),
    new ActionRowBuilder().addComponents(addMenuBuilder),
    new ActionRowBuilder().addComponents(channelMenuBuilder),
    new ActionRowBuilder().addComponents(toggleButton)
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('設定パネルを開きます（自分専用表示）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  buildPanelEmbed,
  buildPanelComponents,

  async execute(interaction) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ このパネルはサーバー所有者しか開けません。', ephemeral: true });
    }

    let config = {};
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {}
    }

    const embed = buildPanelEmbed(interaction.guild, config);
    const components = buildPanelComponents(interaction.guild, config);

    // 自分にのみ表示 (ephemeral: true)
    await interaction.reply({ embeds: [embed], components: components, ephemeral: true });
  }
};
