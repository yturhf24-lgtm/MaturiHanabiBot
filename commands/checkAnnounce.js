const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID || '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('check-announce')
    .setDescription('【限定】OFF設定または返信（送信）できないサーバーの一覧を確認します'),

  async execute(interaction, globalConfig = {}) {
    if (interaction.user.id !== ALLOWED_USER_ID) {
      return interaction.reply({
        content: '❌ このコマンドを実行する権限がありません。',
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guilds = Array.from(interaction.client.guilds.cache.values());
    let offGuilds = [];
    let cantSendGuilds = [];

    for (const guild of guilds) {
      const cfg = globalConfig[guild.id] || {};
      const isAnnounceOff = cfg.announceEnabled === false;

      // 招待リンクの取得（または作成）
      let inviteLink = '取得不可';
      try {
        const invites = await guild.invites.fetch().catch(() => null);
        let validInvite = invites?.find(inv => !inv.expiresTimestamp || inv.expiresTimestamp > Date.now());
        if (validInvite) {
          inviteLink = validInvite.url;
        } else {
          const targetCh = guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.CreateInstantInvite));
          if (targetCh) {
            const newInvite = await targetCh.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);
            if (newInvite) inviteLink = newInvite.url;
          }
        }
      } catch (e) {}

      // 1. OFF設定のサーバー
      if (isAnnounceOff) {
        offGuilds.push(`・**${guild.name}** (\`${guild.id}\`) | 🔗 [招待](${inviteLink})`);
      }

      // 2. 送信（返信）できないサーバーの判定
      let targetChannel = null;
      if (cfg.announceChannelId) {
        targetChannel = guild.channels.cache.get(cfg.announceChannelId);
      }
      if (!targetChannel) {
        targetChannel = guild.channels.cache.find(c => c.name === 'botアナウンス' && c.type === 0); // GuildText
      }
      
      const canSend = targetChannel && targetChannel.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages);
      if (!canSend) {
        cantSendGuilds.push(`・**${guild.name}** (\`${guild.id}\`) | 🔗 [招待](${inviteLink})`);
      }
    }

    const embed = new EmbedBuilder()
      .setTitle('🔍 アナウンス配信除外・送信不可サーバー確認')
      .setColor(0xe74c3c)
      .setDescription(
        `📊 **全導入サーバー数**: ${guilds.length} サーバー\n\n` +
        `🔕 **アナウンスOFF設定のサーバー (${offGuilds.length}件)**\n` +
        (offGuilds.join('\n') || 'なし') + '\n\n' +
        `❌ **メッセージを送信（返信）できないサーバー (${cantSendGuilds.length}件)**\n` +
        `*(※チャンネル未指定かつ #botアナウンス が作成できない、または送信権限がないサーバー)*\n` +
        (cantSendGuilds.join('\n') || 'なし')
      )
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }
};
