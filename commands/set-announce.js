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

// 実行を許可する特定ユーザーのID（環境変数がない場合はフォールバック）
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID || '1266013271518089258';

// パネルEmbed & コンポーネント生成関数
function buildAnnouncePanel(guild, globalConfig) {
  const cfg = globalConfig[guild.id] || {};
  
  // アナウンス設定
  const announceEnabled = cfg.announceEnabled ?? true;
  const announceChId = cfg.announceChannelId || cfg.logChannelId;
  const announceStr = announceChId ? `<#${announceChId}>` : '`未設定`';

  // 再起動通知設定
  const restartEnabled = cfg.restartNotify ?? false;
  const restartChId = cfg.restartNotifyChannelId || announceChId;
  const restartStr = restartChId ? `<#${restartChId}>` : '`未設定`';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ 通知・アナウンス管理パネル')
    .setColor('#3498db')
    .setDescription(
      `下のメニューおよびボタンから設定を変更できます。\n\n` +
      `📢 **通常アナウンス通知**\n` +
      `・送信先: ${announceStr}\n` +
      `・状態: ${announceEnabled ? '🟢 ON (有効)' : '🔴 OFF (無効)'}\n\n` +
      `🔄 **再起動通知**\n` +
      `・送信先: ${restartStr}\n` +
      `・状態: ${restartEnabled ? '🟢 ON (有効)' : '🔴 OFF (無効)'}`
    )
    .setFooter({ text: '※このパネルはあなただけに表示されています' })
    .setTimestamp();

  // 1. チャンネル選択セレクトメニュー
  const channelMenuBuilder = new ChannelSelectMenuBuilder()
    .setCustomId('select_announce_channel')
    .setPlaceholder('通知用チャンネルを選択（未選択で自動作成/検索）')
    .setChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);
  if (announceChId) channelMenuBuilder.setDefaultChannels([announceChId]);

  // 2. ON/OFF 切り替えボタン
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
      new ActionRowBuilder().addComponents(channelMenuBuilder),
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

    // チャンネル未設定の場合の自動判定/補完ロジック
    if (!globalConfig[guild.id].announceChannelId) {
      let existingChannel = guild.channels.cache.find(c => c.name === 'botアナウンス' && c.type === ChannelType.GuildText);
      if (existingChannel) {
        globalConfig[guild.id].announceChannelId = existingChannel.id;
      } else {
        try {
          const createdChannel = await guild.channels.create({
            name: 'botアナウンス',
            type: ChannelType.GuildText,
            reason: 'Botアナウンス送信用チャンネルの自動作成'
          });
          globalConfig[guild.id].announceChannelId = createdChannel.id;
        } catch (e) {
          console.error('自動チャンネル作成失敗:', e);
        }
      }
    }

    // パネルのみをダイレクトに返答
    const panelPayload = buildAnnouncePanel(guild, globalConfig);
    return interaction.reply({ 
      embeds: panelPayload.embeds, 
      components: panelPayload.components, 
      flags: MessageFlags.Ephemeral 
    });
  }
};
