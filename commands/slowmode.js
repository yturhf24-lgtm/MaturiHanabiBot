const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

// 👑 特権を持つ特定のマスターユーザーID
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('全テキスト・アナウンスチャンネル等に一括で低速モードを設定します')
    .addIntegerOption(option =>
      option.setName('time').setDescription('低速時間の数値（0で解除）').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('unit').setDescription('時間の単位を選択').setRequired(true)
        .addChoices(
          { name: '秒 (Seconds)', value: 's' },
          { name: '分 (Minutes)', value: 'm' },
          { name: '時間 (Hours)', value: 'h' }
        )
    ),

  async execute(interaction) {
    const isMasterUser = interaction.user.id === MASTER_USER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];
    const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!isMasterUser && !isAdmin && !hasAllowedRole) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 権限エラー')
            .setDescription('このコマンドを使用する権限がありません。')
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    // ⏱️ 対応速度計測開始
    const startTime = Date.now();

    const timeVal = interaction.options.getInteger('time');
    const unit = interaction.options.getString('unit');

    let seconds = timeVal;
    let unitLabel = '秒';

    if (unit === 'm') { seconds = timeVal * 60; unitLabel = '分'; }
    else if (unit === 'h') { seconds = timeVal * 3600; unitLabel = '時間'; }

    if (seconds > 21600) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ エラー').setDescription('設定できる最大時間は6時間までです。')]
      });
    }

    // 📊 チャンネル種類ごとの細かなカウント用
    let textSuccess = 0;
    let announceSuccess = 0;
    let forumSuccess = 0;   // フォーラムチャンネル
    let threadSuccess = 0;  // 公開スレッド
    let skippedCount = 0;   // 低速モード非対応（ボイス、カテゴリ等）の件数
    const failedChannels = [];

    try {
      const fetchedChannels = await interaction.guild.channels.fetch();
      
      // サーバー内の全チャンネル・スレッドをループ処理
      for (const [_, channel] of fetchedChannels) {
        if (!channel) continue;

        // 1. 低速モードが設定可能なチャンネル種別か判定
        const isSlowmodeApplicable = 
          channel.type === ChannelType.GuildText || 
          channel.type === ChannelType.GuildAnnouncement || 
          channel.type === ChannelType.GuildForum ||
          channel.type === ChannelType.PublicThread;

        if (!isSlowmodeApplicable) {
          // ボイスチャンネル、ステージ、カテゴリ、権限のないプライベートスレッドなどは設定をスキップしてカウント
          skippedCount++;
          continue;
        }

        // 2. 実際に低速モードを設定する
        try {
          await channel.setRateLimitPerUser(seconds);
          
          // 成功した種類を細かくインクリメント
          if (channel.type === ChannelType.GuildText) textSuccess++;
          else if (channel.type === ChannelType.GuildAnnouncement) announceSuccess++;
          else if (channel.type === ChannelType.GuildForum) forumSuccess++;
          else if (channel.type === ChannelType.PublicThread) threadSuccess++;

        } catch (err) {
          // 権限不足などで失敗した場合
          failedChannels.push(`<#${channel.id}> (${getChannelTypeName(channel.type)})`);
        }
      }

      // ⏱️ 対応速度計算
      const processTime = ((Date.now() - startTime) / 1000).toFixed(2);

      // 埋め込みメッセージの構築
      const embed = new EmbedBuilder()
        .setColor(failedChannels.length > 0 ? 0xFFFF00 : 0x00FF00)
        .setTitle('🐢 一括低速モード設定結果')
        .setDescription(`すべての処理を **${processTime}秒** で完了しました。`)
        .addFields(
          { name: '⏳ 設定時間', value: `**${timeVal} ${unitLabel}** (${seconds}秒)`, inline: false },
          { name: '📝 テキスト', value: `成功: **${textSuccess}** 件`, inline: true },
          { name: '📢 アナウンス', value: `成功: **${announceSuccess}** 件`, inline: true },
          { name: '💬 フォーラム', value: `成功: **${forumSuccess}** 件`, inline: true },
          { name: '🧵 公開スレッド', value: `成功: **${threadSuccess}** 件`, inline: true },
          { name: '🚫 対象外(VC/カテゴリ等)', value: `**${skippedCount}** 件`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `実行者: ${interaction.user.tag}` });

      // エラーログの追加
      if (failedChannels.length > 0) {
        embed.addFields({
          name: '⚠️ 権限不足等で失敗したチャンネル',
          value: failedChannels.join('\n'),
          inline: false
        });
      } else {
        embed.addFields({
          name: '✨ エラー状況',
          value: '対象となる全てのチャンネルに正常に適用されました！',
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription('チャンネル情報の同期中に予期せぬエラーが発生しました。')]
      });
    }
  },
};

// 💡 チャンネルタイプIDを日本語の名前に変換するヘルパー関数（エラー表示用）
function getChannelTypeName(type) {
  switch (type) {
    case ChannelType.GuildText: return 'テキスト';
    case ChannelType.GuildAnnouncement: return 'アナウンス';
    case ChannelType.GuildForum: return 'フォーラム';
    case ChannelType.PublicThread: return 'スレッド';
    default: return '不明';
  }
}
