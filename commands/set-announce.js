const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelSelectMenuBuilder,
  ChannelType, 
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');

const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID || '1266013271518089258';

function buildAnnouncePanel(guild, globalConfig) {
  const cfg = globalConfig[guild.id] || {};
  
  const announceEnabled = cfg.announceEnabled ?? true;
  const announceChId = cfg.announceChannelId || null;
  const announceStr = announceChId ? `<#${announceChId}>` : '`未設定`';

  const restartEnabled = cfg.restartNotify ?? false;
  const restartChId = cfg.restartNotifyChannelId || null;
  const restartStr = restartChId ? `<#${restartChId}>` : '`未設定`';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ 通知・アナウンス管理パネル')
    .setColor('#3498db')
    .setDescription(
      `送信先チャンネルおよび通知の ON / OFF を個別に設定できます。\n` +
      `※未設定のままアナウンスが送信された場合、自動的に \`#botアナウンス\` チャンネルが作成されます。\n\n` +
      `📢 **通常アナウンス通知**\n` +
      `・送信先: ${announceStr}\n` +
      `・状態: ${announceEnabled ? '🟢 ON (有効)' : '🔴 OFF (無効)'}\n\n` +
      `🔄 **再起動通知**\n` +
      `・送信先: ${restartStr}\n` +
      `・状態: ${restartEnabled ? '🟢 ON (有効)' : '🔴 OFF (無効)'}`
    )
    .setFooter({ text: '※このパネルはあなただけに表示されています' })
    .setTimestamp();

  const announceMenuBuilder = new ChannelSelectMenuBuilder()
    .setCustomId('select_announce_channel')
    .setPlaceholder('📢 通常アナウンス送信先を選択')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (announceChId) announceMenuBuilder.setDefaultChannels([announceChId]);

  const restartMenuBuilder = new ChannelSelectMenuBuilder()
    .setCustomId('select_restart_channel')
    .setPlaceholder('🔄 再起動通知送信先を選択')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (restartChId) restartMenuBuilder.setDefaultChannels([restartChId]);

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_announce_notify')
      .setLabel(`通常アナウンス: ${announceEnabled ? 'OFFにする' : 'ONにする'}`)
      .setStyle(announceEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('toggle_restart_notify')
      .setLabel(`再起動通知: ${restartEnabled ? 'OFFにする' : 'ONにする'}`)
      .setStyle(restartEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  return { 
    embeds: [embed], 
    components: [
      new ActionRowBuilder().addComponents(announceMenuBuilder),
      new ActionRowBuilder().addComponents(restartMenuBuilder),
      buttonRow
    ] 
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-announce')
    .setDescription('アナウンス・再起動通知の管理パネルを開きます'),

  buildAnnouncePanel,

  async execute(interaction, globalConfig = {}) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ このコマンドはサーバー内でのみ使用できます。',
        flags: MessageFlags.Ephemeral
      });
    }

    const isOwner = interaction.guild.ownerId === interaction.user.id;
    const isAllowedUser = interaction.user.id === ALLOWED_USER_ID;

    if (!isOwner && !isAllowedUser) {
      return interaction.reply({ 
        content: '❌ このコマンドを実行する権限がありません。', 
        flags: MessageFlags.Ephemeral 
      });
    }

    const guild = interaction.guild;
    if (!globalConfig[guild.id]) {
      globalConfig[guild.id] = {};
    }

    // パネル表示のみを行い、チャンネル自動作成は行いません
    const panelPayload = buildAnnouncePanel(guild, globalConfig);
    return interaction.reply({ 
      embeds: panelPayload.embeds, 
      components: panelPayload.components, 
      flags: MessageFlags.Ephemeral 
    });
  }
};
