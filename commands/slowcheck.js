const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowcheck')
    .setDescription('低速チャンネルの状況を確認'),

  async execute(i) {
    await i.deferReply({ flags: 64 });

    const channels = i.guild.channels.cache.filter(ch => ch.type === ChannelType.GuildText);
    
    // ✅ 秒数ごとに整理
    const slowBySec = {};
    const normalChannels = [];

    for (const ch of channels.values()) {
      const sec = ch.rateLimitPerUser;
      if (sec && sec > 0) {
        const key = `${sec}秒`;
        if (!slowBySec[key]) slowBySec[key] = [];
        slowBySec[key].push(ch);
      } else {
        normalChannels.push(ch);
      }
    }

    // ✅ 低速部分を作成
    let slowText = '';
    for (const [sec, list] of Object.entries(slowBySec).sort()) {
      slowText += `🔒 低速あり（${sec}）\n${list.length}件\n\n`;
    }
    if (!slowText) slowText = '🔒 低速あり\n0件\n\n';

    // ✅ 低速なし部分（最大15件まで表示）
    let normalText = '';
    if (normalChannels.length === 0) {
      normalText = 'なし';
    } else {
      const showList = normalChannels.slice(0, 15);
      normalText = showList.map(ch => `<#${ch.id}>`).join('\n');
      if (normalChannels.length > 15) {
        normalText += `\n...他 ${normalChannels.length - 15}チャンネル`;
      }
    }

    // ✅ 表示
    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle('📊 低速チャンネル')
      .addFields(
        { name: '━━━━━━ 低速あり ━━━━━━', value: slowText.trim() },
        { name: '━━━━━━ 低速なし ━━━━━━', value: normalText }
      );

    await i.editReply({ embeds: [embed] });
  }
};
