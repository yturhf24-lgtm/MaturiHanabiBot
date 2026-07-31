const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';
const messageCache = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anti-invite')
    .setDescription('【特別ユーザー・サーバーオーナー専用】招待リンクの連投荒らし対策を設定します')
    // 必須オプションを先にする
    .addStringOption(option =>
      option.setName('status')
        .setDescription('ON または OFF を選択')
        .setRequired(true)
        .addChoices(
          { name: 'ON', value: 'on' },
          { name: 'OFF', value: 'off' }
        )
    )
    // 任意オプションを後ろにする
    .addChannelOption(option =>
      option.setName('log-channel')
        .setDescription('ログを送信するチャンネル（ONの時のみ有効）')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option.setName('timeout-minutes')
        .setDescription('タイムアウトする時間（分）※デフォルト: 10分')
        .setMinValue(1)
        .setMaxValue(1440)
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
    const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;

    if (!isSpecialUser && !isGuildOwner) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('このコマンドは実行できません。')]
      });
    }

    const status = interaction.options.getString('status');
    const logChannel = interaction.options.getChannel('log-channel') || interaction.channel;
    const timeoutMinutes = interaction.options.getInteger('timeout-minutes') || 10;
    const guildId = interaction.guildId;

    const settings = client.getSettings();
    if (!settings[guildId]) settings[guildId] = {};

    if (status === 'on') {
      settings[guildId].antiInvite = {
        enabled: true,
        logChannelId: logChannel.id,
        timeoutMinutes: timeoutMinutes
      };
      await client.saveSettings(settings);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🛡️ 招待リンク荒らし対策: ON')
            .setDescription(`設定を有効化しました。\n・ログ送信先: <#${logChannel.id}>\n・タイムアウト: ${timeoutMinutes}分`)
        ]
      });
    } else {
      settings[guildId].antiInvite = { enabled: false, logChannelId: null, timeoutMinutes: 10 };
      await client.saveSettings(settings);

      await interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('🛡️ 招待リンク荒らし対策: OFF').setDescription('無効化しました。')]
      });
    }
  },

  async handleMessage(message, client) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const settings = client.getSettings();
    const antiConfig = settings[guildId]?.antiInvite;
    if (!antiConfig || !antiConfig.enabled) return;

    const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invites)\/[a-zA-Z0-9]+/g;
    const matches = message.content.match(inviteRegex);
    if (!matches) return;

    const inviteLink = matches[0];
    const userId = message.author.id;
    const now = Date.now();
    const cacheKey = `${guildId}-${userId}-${inviteLink}`;

    if (!messageCache.has(cacheKey)) messageCache.set(cacheKey, []);
    const timestamps = messageCache.get(cacheKey).filter(t => now - t < 3000);
    timestamps.push(now);
    messageCache.set(cacheKey, timestamps);

    if (timestamps.length >= 3) {
      messageCache.delete(cacheKey);

      try {
        if (message.deletable) await message.delete().catch(() => {});

        const timeoutDuration = (antiConfig.timeoutMinutes || 10) * 60 * 1000;
        const member = await message.guild.members.fetch(userId).catch(() => null);
        let timeoutSuccess = false;
        if (member && member.moderatable) {
          await member.timeout(timeoutDuration, '招待リンクの連投荒らし対策');
          timeoutSuccess = true;
        }

        const logChannel = message.guild.channels.cache.get(antiConfig.logChannelId);
        if (logChannel) {
          const mentionText = message.author.bot ? '@everyone\n' : '';
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 荒らし（招待リンク連投）を検知しました')
            .setDescription(`${mentionText}ユーザー: <@${userId}>\n処置: メッセージ削除 ＆ ${timeoutSuccess ? `${antiConfig.timeoutMinutes}分タイムアウト` : 'タイムアウト失敗'}`)
            .setTimestamp();

          const sentMsg = await logChannel.send({ embeds: [embed] }).catch(() => null);
          if (sentMsg) setTimeout(() => sentMsg.delete().catch(() => {}), 10000);
        }
      } catch (err) {
        console.error('エラー:', err);
      }
    }
  }
};
