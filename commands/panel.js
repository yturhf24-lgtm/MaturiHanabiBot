const { SlashCommandBuilder, ActionRowBuilder, RoleSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

// パネル用のEmbedメッセージを生成する関数
function buildPanelEmbed(guild, config) {
  const c = config[guild.id] || {};
  
  const conditionStr = c.conditionRoleId ? `<@&${c.conditionRoleId}>` : '未設定';
  const removeStr = (c.removeRoleIds && c.removeRoleIds.length > 0) ? c.removeRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし';
  const addStr = (c.addRoleIds && c.addRoleIds.length > 0) ? c.addRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし';
  const logStr = c.logChannelId ? `<#${c.logChannelId}>` : '未設定';

  return new EmbedBuilder()
    .setTitle('🛡️ ロール自動更新・設定管理パネル')
    .setDescription('各メニューから設定項目を選択してください。設定内容は即時保存されます。\n（※Botが**5分ごと**および**オンライン復帰時**に自動監視します）')
    .setColor(0x001f3f)
    .addFields(
      { name: '1. 条件判定ロール (単一)', value: conditionStr, inline: false },
      { name: '2. 削除対象ロール (複数可)', value: removeStr, inline: true },
      { name: '3. 追加対象ロール (複数可)', value: addStr, inline: true },
      { name: '4. Log返信チャンネル', value: logStr, inline: false }
    )
    .setFooter({ text: '⚠️ このパネルおよび操作はサーバー所有者のみ利用可能です' })
    .setTimestamp();

}

// パネルの操作用UIコンポーネント（メニュー・ボタン）を生成
function buildPanelComponents() {
  // 1. 条件ロール選択 (単一)
  const conditionMenu = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('select_condition_role')
      .setPlaceholder('1. 条件ロールを選択 (1つのみ)')
      .setMinValues(1)
      .setMaxValues(1)
  );

  // 2. 削除対象ロール選択 (複数可能)
  const removeMenu = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('select_remove_roles')
      .setPlaceholder('2. 削除するロールを選択 (複数可能 / 任意)')
      .setMinValues(0)
      .setMaxValues(10)
  );

  // 3. 追加対象ロール選択 (複数可能)
  const addMenu = new ActionRowBuilder().addComponents(
    new RoleSelectMenuBuilder()
      .setCustomId('select_add_roles')
      .setPlaceholder('3. 追加するロールを選択 (複数可能 / 任意)')
      .setMinValues(0)
      .setMaxValues(10)
  );

  // 4. Log返信チャンネル選択
  const channelMenu = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId('select_log_channel')
      .setPlaceholder('4. Log返信チャンネルを選択')
      .setChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1)
  );

  // 5. 手動実行ボタン
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('process_roles_button')
      .setLabel('今すぐロール更新を即時実行')
      .setStyle(ButtonStyle.Primary)
  );

  return [conditionMenu, removeMenu, addMenu, channelMenu, buttonRow];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('管理パネルを表示します（サーバー所有者限定）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  buildPanelEmbed,
  buildPanelComponents,

  async execute(interaction) {
    // サーバー所有者のみ実行可能
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ このパネルはサーバー所有者のみ開くことができます。', ephemeral: true });
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
