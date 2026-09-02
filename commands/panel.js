const { SlashCommandBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

// パネル用のEmbedメッセージを生成する関数
function buildPanelEmbed(guild, config) {
  const c = config[guild.id] || {};
  
  const conditionStr = c.conditionRoleId ? `<@&${c.conditionRoleId}>` : '未設定（選択必須）';
  const removeStr = (c.removeRoleIds && c.removeRoleIds.length > 0) ? c.removeRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし';
  const addStr = (c.addRoleIds && c.addRoleIds.length > 0) ? c.addRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし';
  const logStr = c.logChannelId ? `<#${c.logChannelId}>` : '未設定（なしでもOK）';

  return new EmbedBuilder()
    .setTitle('🛡️ ロール自動制御パネル')
    .setDescription(
      '下のメニューから対象の役職や設定を選択してください。\n' +
      '設定した内容は自動保存され、**5分ごとの定時チェック＆Bot起動時**に自動適用されます。'
    )
    .setColor(0x001f3f)
    .addFields(
      { name: '🔍 1. チェックするロール（この役職を持っている人だけ処理）', value: conditionStr, inline: false },
      { name: '🗑️ 2. 自動で外すロール', value: removeStr, inline: true },
      { name: '➕ 3. 自動でつけるロール', value: addStr, inline: true },
      { name: '📜 4. ログ送信先チャンネル', value: logStr, inline: false }
    )
    .setFooter({ text: '※この操作パネルはサーバー所有者のみ利用可能です' })
    .setTimestamp();
}

// パネルの操作用メニューを生成
function buildPanelComponents() {
  // 1. チェック対象ロール選択
  const conditionMenu = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('select_condition_role')
      .setPlaceholder('1. チェックするロールを選ぶ（1つ選択）')
      .setMinValues(1)
      .setMaxValues(1)
  );

  // 2. 削除対象ロール選択
  const removeMenu = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('select_remove_roles')
      .setPlaceholder('2. 自動で外したいロールを選ぶ（複数選択可）')
      .setMinValues(0)
      .setMaxValues(10)
  );

  // 3. 付与対象ロール選択
  const addMenu = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('select_add_roles')
      .setPlaceholder('3. 自動でつけたいロールを選ぶ（複数選択可）')
      .setMinValues(0)
      .setMaxValues(10)
  );

  // 4. ログチャンネル選択
  const channelMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_log_channel')
      .setPlaceholder('4. ログを送るチャンネルを選ぶ（なしでもOK）')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
  );

  // 5. 手動一括実行ボタン
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('process_roles_button')
      .setLabel('🚀 今すぐ全員に適用する（手動実行）')
      .setStyle(ButtonStyle.Success)
  );

  return [conditionMenu, removeMenu, addMenu, channelMenu, buttonRow];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('設定パネルを開きます（サーバー所有者専用）')
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
    const components = buildPanelComponents();

    await interaction.reply({ embeds: [embed], components: components });
  }
};
