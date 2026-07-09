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
    // 実行者がサーバー管理者かどうか
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    
    // 保存データからこのサーバーの許可ロール一覧を取得
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];
    
    // 実行者が許可ロールを保持しているかチェック
    const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    // 管理者でもなく、許可ロールも持っていない場合は実行を拒否
    if (!isAdmin && !hasAllowedRole) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('権限エラー')
            .setDescription('このコマンドを使用する権限がありません。（サーバー管理者または許可ロールが必要です）')
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const timeVal = interaction.options.getInteger('time');
    const unit = interaction.options.getString('unit');

    let seconds = timeVal;
    let unitLabel = '秒';

    if (unit === 'm') { seconds = timeVal * 60; unitLabel = '分'; }
    else if (unit === 'h') { seconds = timeVal * 3600; unitLabel = '時間'; }

    if (seconds > 21600) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('エラー').setDescription('設定できる最大時間は6時間（21600秒）までです。')]
      });
    }

    let successCount = 0;
    let failCount = 0;
    const channels = interaction.guild.channels.cache.filter(c => c.type === ChannelType.GuildText);

    for (const [_, channel] of channels) {
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
  },
};
