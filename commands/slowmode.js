const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('全テキストチャンネルに一括で低速モードを設定します')
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
    // タイムアウト（応答なし）を防ぐための最優先処理
    await interaction.deferReply();

    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    
    // このサーバーの許可ロール一覧をデータファイルから照合
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];
    const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!isAdmin && !hasAllowedRole) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('権限エラー')
            .setDescription('このコマンドを使用する権限がありません。（サーバー管理者または登録された許可ロールが必要です）')
        ]
      });
    }

    const timeVal = interaction.options.getInteger('time');
    const unit = interaction.options.getString('unit');

    let seconds = timeVal;
    let unitLabel = '秒';

    if (unit === 'm') { seconds = timeVal * 60; unitLabel = '分'; }
    else if (unit === 'h') { seconds = timeVal * 3600; unitLabel = '時間'; }

    if (seconds > 21600) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('エラー').setDescription('設定できる最大時間は6時間までです。')]
      });
    }

    let successCount = 0;
    let failCount = 0;

    try {
      // 複数サーバー対応：キャッシュではなく、コマンドを実行したサーバーの全チャンネルを最新状態として取得
      const fetchedChannels = await interaction.guild.channels.fetch();
      const textChannels = fetchedChannels.filter(c => c && c.type === ChannelType.GuildText);

      for (const [_, channel] of textChannels) {
        try {
          await channel.setRateLimitPerUser(seconds);
          successCount++;
        } catch (err) {
          failCount++;
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🐢 低速モード設定完了')
        .addFields(
          { name: '設定した低速時間', value: `${timeVal} ${unitLabel} (${seconds}秒)`, inline: true },
          { name: '対象チャンネル数', value: `成功: ${successCount} / 失敗: ${failCount}`, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `実行者: ${interaction.user.tag}` });

      await interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error(error);
      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setDescription('チャンネル情報の同期中に予期せぬエラーが発生しました。')]
      });
    }
  },
};
