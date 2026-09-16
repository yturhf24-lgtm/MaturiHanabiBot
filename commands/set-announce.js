const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionFlagsBits 
} = require('discord.js');

// 設定データ保持 ( guildId -> { announceChannelId, restartChannelId, announceEnabled, restartEnabled } )
// ※ 永続化する場合は DB / JSONファイルへ書き出しを推奨
const settings = new Map();

function getGuildSettings(guildId) {
  if (!settings.has(guildId)) {
    settings.set(guildId, {
      announceChannelId: null,
      restartChannelId: null,
      announceEnabled: true,
      restartEnabled: true
    });
  }
  return settings.get(guildId);
}

// パネルEmbed & ボタン生成ヘルパー
function buildPanelComponents(guild, config) {
  const announceCh = config.announceChannelId ? `<#${config.announceChannelId}>` : '`未設定`';
  const restartCh = config.restartChannelId ? `<#${config.restartChannelId}>` : '`未設定`';

  const embed = new EmbedBuilder()
    .setTitle('⚙️ 通知・アナウンス管理パネル')
    .setColor('#3498db')
    .setDescription(
      `**現在の設定状況**\n\n` +
      `📢 **通常アナウンス通知**\n` +
      `・送信先: ${announceCh}\n` +
      `・状態: ${config.announceEnabled ? '🟢 ON (有効)' : '🔴 OFF (無効)'}\n\n` +
      `🔄 **再起動通知**\n` +
      `・送信先: ${restartCh}\n` +
      `・状態: ${config.restartEnabled ? '🟢 ON (有効)' : '🔴 OFF (無効)'}\n\n` +
      `*下のボタンでそれぞれの ON / OFF を切り替えられます。*`
    );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_announce')
      .setLabel(`アナウンス: ${config.announceEnabled ? 'OFFにする' : 'ONにする'}`)
      .setStyle(config.announceEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('toggle_restart')
      .setLabel(`再起動通知: ${config.restartEnabled ? 'OFFにする' : 'ONにする'}`)
      .setStyle(config.restartEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-announce')
    .setDescription('アナウンス・再起動通知の送信先指定およびパネルの管理')
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('指定するテキストチャンネル（未指定の場合は #botアナウンス を自動検索/作成）')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption(option =>
      option.setName('type')
        .setDescription('設定対象の通知タイプ（指定なしの場合は両方に適用）')
        .addChoices(
          { name: '両方 (アナウンス & 再起動)', value: 'both' },
          { name: '通常アナウンスのみ', value: 'announce' },
          { name: '再起動通知のみ', value: 'restart' }
        )
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: '❌ このコマンドを実行する権限（チャンネル管理）がありません。', ephemeral: true });
    }

    const guild = interaction.guild;
    const targetChannel = interaction.options.getChannel('channel');
    const targetType = interaction.options.getString('type') || 'both';
    const config = getGuildSettings(guild.id);

    let noticeMessage = '';

    // 1. チャンネルが指定されている場合
    if (targetChannel) {
      if (targetType === 'both' || targetType === 'announce') config.announceChannelId = targetChannel.id;
      if (targetType === 'both' || targetType === 'restart') config.restartChannelId = targetChannel.id;
      
      noticeMessage = `✅ 送信先チャンネルを ${targetChannel} に設定しました。`;
    } 
    // 2. チャンネルが指定されていない場合
    else {
      let existingChannel = guild.channels.cache.find(c => c.name === 'botアナウンス' && c.type === ChannelType.GuildText);

      if (existingChannel) {
        // 既存の #botアナウンス が存在する場合（作成せず警告を表示）
        return interaction.reply({
          content: `⚠️ すでに ${existingChannel} チャンネルが存在します。\n送信先にセットする場合は \`/set-announce channel:#${existingChannel.name}\` コマンドを実行して指定してください。`,
          ephemeral: true
        });
      } else {
        // 存在しない場合は新規作成して割り当て
        try {
          const createdChannel = await guild.channels.create({
            name: 'botアナウンス',
            type: ChannelType.GuildText,
            reason: 'Botアナウンス送信用チャンネルの自動生成'
          });

          if (targetType === 'both' || targetType === 'announce') config.announceChannelId = createdChannel.id;
          if (targetType === 'both' || targetType === 'restart') config.restartChannelId = createdChannel.id;

          noticeMessage = `📁 \`#botアナウンス\` チャンネルを新規作成し、送信先に割り当てました。`;
        } catch (error) {
          console.error(error);
          return interaction.reply({ content: '❌ チャンネルの自動作成に失敗しました。Botに適切な作成権限があるか確認してください。', ephemeral: true });
        }
      }
    }

    // パネル表示
    const panelPayload = buildPanelComponents(guild, config);
    return interaction.reply({ 
      content: noticeMessage,
      embeds: panelPayload.embeds, 
      components: panelPayload.components, 
      ephemeral: true 
    });
  },

  // ボタンによる ON/OFF 切り替え処理
  async handleButton(interaction) {
    const config = getGuildSettings(interaction.guildId);

    if (interaction.customId === 'toggle_announce') {
      config.announceEnabled = !config.announceEnabled;
    } else if (interaction.customId === 'toggle_restart') {
      config.restartEnabled = !config.restartEnabled;
    } else {
      return;
    }

    const updatedPayload = buildPanelComponents(interaction.guild, config);
    await interaction.update(updatedPayload);
  },

  getSettingsMap: () => settings
};
