const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

// 👑 特権を持つ特定のマスターユーザーID
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('全テキスト・アナウンスチャンネルに一括で低速モードを設定します')
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

    // ⏱️ 対応速度（処理時間）計測開始
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

    // チャンネル種別ごとのカウント用
    let textSuccess = 0;
    let announceSuccess = 0;
    const failedChannels = []; // 権限不足などで失敗したチャンネルのリスト

    try {
      const fetchedChannels = await interaction.guild.channels.fetch();
      // テキストチャンネル(GuildText)とアナウンスチャンネル(GuildAnnouncement)を対象にする
      const targetChannels = fetchedChannels.filter(
        c => c && (c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement)
      );

      for (const [_, channel] of targetChannels) {
        try {
          await channel.setRateLimitPerUser(seconds);
          
          if (channel.type === ChannelType.GuildText) {
            textSuccess++;
          } else if (channel.type === ChannelType.GuildAnnouncement) {
            announceSuccess++;
          }
        } catch (err) {
          // 権限不足などで失敗したチャンネル名と理由を記録
          failedChannels.push(`<#${channel.id}> (権限不足等)`);
        }
      }

      // ⏱️ 対応速度（処理時間）計算
      const processTime = ((Date.now() - startTime) / 1000).toFixed(2);

      // 埋め込みメッセージの構築
      const embed = new EmbedBuilder()
        .setColor(failedChannels.length > 0 ? 0xFFFF00 : 0x00FF00) // 一部失敗があれば黄色、全成功なら緑
        .setTitle('🐢 一括低速モード設定結果')
        .setDescription(`すべての設定処理を **${processTime}秒** で完了しました。`)
        .addFields(
          { name: '⏳ 設定時間', value: `**${timeVal} ${unitLabel}** (${seconds}秒)`, inline: false },
          { name: '📝 テキストチャンネル', value: `成功: **${textSuccess}** 件`, inline: true },
          { name: '📢 アナウンスチャンネル', value: `成功: **${announceSuccess}** 件`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `実行者: ${interaction.user.tag} | ID: ${interaction.user.id}` });

      // 失敗したチャンネルがあれば埋め込みに追加
      if (failedChannels.length > 0) {
        embed.addFields({
          name: '⚠️ 権限不足等でスキップされたチャンネル',
          value: failedChannels.join('\n'),
          inline: false
        });
      } else {
        embed.addFields({
          name: '✨ エラー状況',
          value: '全ての対象チャンネルに正常に適用されました！',
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
