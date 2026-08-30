const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowcheck')
    .setDescription('低速チャンネルの状況を確認'),

  async execute(i) {
    await i.deferReply({ flags: 64 });

    const channels = i.guild.channels.cache.filter(ch => ch.type === ChannelType.GuildText);
    const slowChannels = [];
    const normalChannels = [];

    // ✅ 各チャンネルの低速設定を確認
    for (const ch of channels.values()) {
      const rateLimit = ch.rateLimitPerUser;
      if (rateLimit && rateLimit > 0) {
        const sec = rateLimit === 1 ? '1秒' : `${rateLimit}秒`;
        slowChannels.push(`<#${ch.id}>（${sec}）`);
      } else {
        normalChannels.push(`<#${ch.id}>`);
      }
    }

    // ✅ 結果を整形
    const slowCount = slowChannels.length;
    const normalCount = normalChannels.length;

    // ✅ Discordの文字数制限（1024文字）を考慮
    let slowText = slowChannels.join('\n');
    let normalText = normalChannels.join('\n');

    if (slowText.length > 1000) slowText = slowChannels.slice(0, 30).join('\n') + `\n...他 ${slowCount - 30}チャンネル`;
    if (normalText.length > 1000) normalText = normalChannels.slice(0, 30).join('\n') + `\n...他 ${normalCount - 30}チャンネル`;

    if (!slowText) slowText = 'なし';
    if (!normalText) normalText = 'なし';

    // ✅ 埋め込みメッセージで表示
    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle('📊 低速チャンネル確認')
      .addFields(
        { name: `🔒 低速付きチャンネル：${slowCount}チャンネル`, value: slowText },
        { name: `✅ 低速なしチャンネル：${normalCount}チャンネル`, value: normalText }
      )
      .setTimestamp();

    await i.editReply({ embeds: [embed] });
  }
};
