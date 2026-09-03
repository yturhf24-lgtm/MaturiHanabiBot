const { 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ChannelSelectMenuBuilder, 
  ChannelType, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  PermissionFlagsBits, 
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');

function buildCountPanelEmbed(guild, config) {
  const c = config[guild.id]?.countConfig || {};

  const enabledStr = c.enabled ? '🟢 動作中' : '🔴 停止中';
  const channelStr = c.channelId ? `<#${c.channelId}>` : '未設定（選択必須）';
  const currentNumStr = c.currentNum !== undefined ? `**${c.currentNum}**` : '**0** (次は 1)';
  const deleteStr = (c.deleteWrong === false) ? '🔕 OFF（削除しない）' : '🗑️ ON（自動削除）';
  const warnStr = (c.warnEmbed === false) ? '🔕 OFF' : '🔔 ON（警告Embed表示）';

  return new EmbedBuilder()
    .setTitle('🔢 数字数え上げ（カウンター）設定パネル')
    .setDescription(
      '指定したチャンネルで順番に数字を投稿させる機能を設定します。\n' +
      '間違った数字の削除や警告メッセージの設定が可能です。'
    )
    .setColor(c.enabled ? 0x00ff00 : 0xff0000)
    .addFields(
      { name: '⚡ 機能ステータス', value: enabledStr, inline: true },
      { name: '🔢 現在の数字 (次はこの+1)', value: currentNumStr, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '🗑️ 間違った数字の削除', value: deleteStr, inline: true },
      { name: '⚠️ 警告Embed表示', value: warnStr, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '📌 対象チャンネル', value: channelStr, inline: false }
    )
    .setFooter({ text: '※この操作パネルはあなただけに表示されています' })
    .setTimestamp();
}

function buildCountPanelComponents(guild, config) {
  const c = config[guild.id]?.countConfig || {};

  const channelMenuBuilder = new ChannelSelectMenuBuilder()
    .setCustomId('select_count_channel')
    .setPlaceholder('数字をカウントするチャンネルを選択')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (c.channelId) channelMenuBuilder.setDefaultChannels([c.channelId]);

  const setNumberButton = new ButtonBuilder()
    .setCustomId('open_set_number_modal')
    .setLabel('🔢 現在の数字を変更')
    .setStyle(ButtonStyle.Secondary);

  // 誤送信メッセージ削除 ON/OFF ボタン
  const deleteButton = new ButtonBuilder()
    .setCustomId('toggle_count_delete')
    .setLabel((c.deleteWrong === false) ? '🗑️ 誤投稿削除: OFF' : '🗑️ 誤投稿削除: ON')
    .setStyle((c.deleteWrong === false) ? ButtonStyle.Secondary : ButtonStyle.Danger);

  const warnButton = new ButtonBuilder()
    .setCustomId('toggle_count_warn')
    .setLabel((c.warnEmbed === false) ? '⚠️ 警告Embed: OFF' : '⚠️ 警告Embed: ON')
    .setStyle((c.warnEmbed === false) ? ButtonStyle.Secondary : ButtonStyle.Primary);

  const toggleButton = new ButtonBuilder()
    .setCustomId('toggle_count_active')
    .setLabel(c.enabled ? '⏹️ カウント機能を停止' : '▶️ カウント機能を開始')
    .setStyle(c.enabled ? ButtonStyle.Danger : ButtonStyle.Success);

  return [
    new ActionRowBuilder().addComponents(channelMenuBuilder),
    new ActionRowBuilder().addComponents(setNumberButton, deleteButton, warnButton),
    new ActionRowBuilder().addComponents(toggleButton)
  ];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('count-panel')
    .setDescription('数字カウンター機能の設定パネルを開きます')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  buildCountPanelEmbed,
  buildCountPanelComponents,

  async execute(interaction, globalConfig = {}) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ このパネルはサーバー所有者しか開けません。', flags: MessageFlags.Ephemeral });
    }

    const embed = buildCountPanelEmbed(interaction.guild, globalConfig);
    const components = buildCountPanelComponents(interaction.guild, globalConfig);

    await interaction.reply({ embeds: [embed], components: components, flags: MessageFlags.Ephemeral });
  }
};
