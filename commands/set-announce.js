const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ChannelType, 
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');

// 実行を許可する特定ユーザーのID（環境変数がない場合はフォールバック）
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID || '1266013271518089258';

// パネルEmbed & ボタン生成関数
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
      `現在の各通知設定と送信先チャンネルです。\n下のボタンを押すことで通知の ON / OFF を切り替えられます。\n\n` +
      `📢 **通常アナウンス通知**\n` +
      `・送信先: ${announceStr}\n` +
      `・状態: ${announceEnabled ? '🟢 ON (有効)' : '🔴 OFF (無効)'}\n\n` +
      `🔄 **再起動通知**\n` +
      `・送信先: ${restartStr}\n` +
      `・状態: ${restartEnabled ? '🟢 ON (有効)' : '🔴 OFF (無効)'}`
    )
    .setFooter({ text: '※このパネルは操作者だけに表示されています' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_announce_notify')
      .setLabel(`通常アナウンス: ${announceEnabled ? 'OFFにする' : 'ONにする'}`)
      .setStyle(announceEnabled ? ButtonStyle.Danger : ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('toggle_restart_notify')
      .setLabel(`再起動通知: ${restartEnabled ? 'OFFにする' : 'ONにする'}`)
      .setStyle(restartEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-announce')
    .setDescription('アナウンス・再起動通知の送信先指定および管理パネルを表示します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(option => 
      option.setName('channel')
        .setDescription('指定するテキストチャンネル（未指定の場合は #botアナウンス を自動検索/作成）')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

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
    const targetChannel = interaction.options.getChannel('channel');

    if (!globalConfig[guild.id]) {
      globalConfig[guild.id] = {};
    }

    let warningText = '';

    // 1. チャンネルが指定されている場合
    if (targetChannel) {
      globalConfig[guild.id].announceChannelId = targetChannel.id;
      globalConfig[guild.id].restartNotifyChannelId = targetChannel.id;
    } 
    // 2. チャンネルが指定されていない場合
    else {
      let existingChannel = guild.channels.cache.find(c => c.name === 'botアナウンス' && c.type === ChannelType.GuildText);

      if (existingChannel) {
        // 既に同名チャンネルが存在する場合（警告を表示してコマンド指定を促す）
        warningText = `⚠️ 既に ${existingChannel} チャンネルが存在します。\nこのチャンネルにセットしたい場合は \`/set-announce channel:#${existingChannel.name}\` を指定して実行してください。\n\n`;
      } else {
        // 存在しない場合は自動作成
        try {
          const createdChannel = await guild.channels.create({
            name: 'botアナウンス',
            type: ChannelType.GuildText,
            reason: 'Botアナウンス送信用チャンネルの自動作成'
          });

          globalConfig[guild.id].announceChannelId = createdChannel.id;
          globalConfig[guild.id].restartNotifyChannelId = createdChannel.id;
          warningText = `📁 \`#botアナウンス\` チャンネルを作成し、送信先に割り当てました！\n\n`;
        } catch (error) {
          console.error(error);
          return interaction.reply({ 
            content: '❌ チャンネルの自動作成に失敗しました。Botにチャンネル管理権限があるか確認してください。', 
            flags: MessageFlags.Ephemeral 
          });
        }
      }
    }

    const panelPayload = buildAnnouncePanel(guild, globalConfig);

    return interaction.reply({ 
      content: warningText ? warningText : undefined,
      embeds: panelPayload.embeds, 
      components: panelPayload.components, 
      flags: MessageFlags.Ephemeral 
    });
  }
};
