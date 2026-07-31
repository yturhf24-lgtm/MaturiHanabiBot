const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';
const spamCache = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anti-spam-message')
    .setDescription('【特別ユーザー・サーバーオーナー専用】メッセージの連投スパム対策を設定します')
    // 必須オプションを先にする
    .addStringOption(option =>
      option.setName('status')
        .setDescription('ON または OFF')
        .setRequired(true)
        .addChoices({ name: 'ON', value: 'on' }, { name: 'OFF', value: 'off' })
    )
    .addChannelOption(option =>
      option.setName('log-channel')
        .setDescription('ログを送信するチャンネル')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('seconds')
        .setDescription('何秒以内か')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('count')
        .setDescription('何回投稿したら')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('action')
        .setDescription('実行する処置')
        .setRequired(true)
        .addChoices(
          { name: 'メッセージ削除のみ', value: 'delete' },
          { name: '削除 ＋ 10分タイムアウト', value: 'timeout' },
          { name: '削除 ＋ Kick', value: 'kick' },
          { name: '削除 ＋ BAN', value: 'ban' }
        )
    )
    // 任意オプションを後ろにする
    .addRoleOption(option =>
      option.setName('mention-role')
        .setDescription('通知時にメンションするロール（任意）')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    if (interaction.user.id !== SPECIAL_USER_ID && interaction.guild?.ownerId !== interaction.user.id) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('権限がありません。')] });
    }

    const status = interaction.options.getString('status');
    const logChannel = interaction.options.getChannel('log-channel');
    const seconds = interaction.options.getInteger('seconds');
    const count = interaction.options.getInteger('count');
    const action = interaction.options.getString('action');
    const mentionRole = interaction.options.getRole('mention-role');
    const guildId = interaction.guildId;

    const settings = client.getSettings();
    if (!settings[guildId]) settings[guildId] = {};

    settings[guildId].antiSpamMsg = {
      enabled: status === 'on',
      logChannelId: logChannel.id,
      seconds,
      count,
      action,
      mentionRoleId: mentionRole ? mentionRole.id : null
    };
    await client.saveSettings(settings);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(status === 'on' ? 0x00FF00 : 0xFF0000)
          .setTitle(`💬 スパム対策: ${status.toUpperCase()}`)
          .setDescription(`条件: ${seconds}秒以内に${count}回\n処置: ${action}\nログ: <#${logChannel.id}>`)
      ]
    });
  },

  async handleMessage(message, client) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const settings = client.getSettings();
    const config = settings[guildId]?.antiSpamMsg;
    if (!config || !config.enabled) return;

    const userId = message.author.id;
    const now = Date.now();
    const key = `${guildId}-${userId}`;

    if (!spamCache.has(key)) spamCache.set(key, []);
    const timestamps = spamCache.get(key).filter(t => now - t < config.seconds * 1000);
    timestamps.push(now);
    spamCache.set(key, timestamps);

    if (timestamps.length >= config.count) {
      spamCache.delete(key);

      try {
        if (message.channel.permissionsFor(message.guild.members.me).has('ManageMessages')) {
          const fetched = await message.channel.messages.fetch({ limit: config.count }).catch(() => null);
          if (fetched) {
            const userMsgs = fetched.filter(m => m.author.id === userId);
            await message.channel.bulkDelete(userMsgs, true).catch(() => message.delete().catch(() => {}));
          }
        }

        const member = await message.guild.members.fetch(userId).catch(() => null);
        let actionText = 'メッセージ削除';

        if (member) {
          if (config.action === 'timeout' && member.moderatable) {
            await member.timeout(10 * 60 * 1000, 'スパムメッセージ連投');
            actionText = 'メッセージ削除 ＆ 10分タイムアウト';
          } else if (config.action === 'kick' && member.kickable) {
            await member.kick('スパムメッセージ連投');
            actionText = 'メッセージ削除 ＆ Kick';
          } else if (config.action === 'ban' && member.bannable) {
            await member.ban({ reason: 'スパムメッセージ連投' });
            actionText = 'メッセージ削除 ＆ BAN';
          }
        }

        const logChannel = message.guild.channels.cache.get(config.logChannelId);
        if (logChannel) {
          const mentionText = config.mentionRoleId ? `<@&${config.mentionRoleId}>\n` : '';
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 スパムメッセージ検知')
            .setDescription(`${mentionText}ユーザー: <@${userId}>\n処置: ${actionText}`)
            .setTimestamp();
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (err) {
        console.error('エラー:', err);
      }
    }
  }
};
