const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

// メッセージ検知用のキャッシュ（サーバーごと・ユーザーごとに管理）
const messageCache = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anti-invite')
    .setDescription('【特別ユーザー・サーバーオーナー専用】招待リンクの連投荒らし対策を設定します')
    .addStringOption(option =>
      option.setName('status')
        .setDescription('ON または OFF を選択')
        .setRequired(true)
        .addChoices(
          { name: 'ON', value: 'on' },
          { name: 'OFF', value: 'off' }
        )
    ),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    // 権限チェック（特別ユーザー または サーバーオーナーのみ）
    const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;
    const isGuildOwner = interaction.guild?.ownerId === interaction.user.id;

    if (!isSpecialUser && !isGuildOwner) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 権限エラー')
            .setDescription('このコマンドはサーバーの所有者または指定されたプレイヤーのみ実行可能です。')
        ]
      });
    }

    const status = interaction.options.getString('status');
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    const settings = client.getSettings();
    if (!settings[guildId]) {
      settings[guildId] = {};
    }

    if (status === 'on') {
      settings[guildId].antiInvite = {
        enabled: true,
        logChannelId: channelId // 実行したチャンネルをログ出力先にする
      };
      await client.saveSettings(settings);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🛡️ 招待リンク荒らし対策: ON')
            .setDescription(`このチャンネル（<#${channelId}>）をログ出力先として、荒らし対策を有効化しました。\n\n**【設定内容】**\n・適用範囲: 全チャンネル\n・条件: 3秒以内に3回同じ招待リンク\n・処置: メッセージ削除 ＆ 10分タイムアウト\n・Botの場合: 全体メンション（@everyone）でお知らせ\n・ログ: このチャンネルに送信（10秒で自動消滅）`)
        ]
      });
    } else {
      settings[guildId].antiInvite = {
        enabled: false,
        logChannelId: null
      };
      await client.saveSettings(settings);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🛡️ 招待リンク荒らし対策: OFF')
            .setDescription('招待リンクの荒らし対策を無効化しました。')
        ]
      });
    }
  },

  // -------------------------------------------------------------
  // 🔍 メッセージ検知・自動処置ロジック（index.js等から呼び出す用）
  // -------------------------------------------------------------
  async handleMessage(message, client) {
    if (!message.guild || message.author.bot) return;

    const guildId = message.guild.id;
    const settings = client.getSettings();
    const antiConfig = settings[guildId]?.antiInvite;

    if (!antiConfig || !antiConfig.enabled) return;

    // 招待リンクの正規表現（discord.gg/ または discord.com/invite/ 等）
    const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li)|discordapp\.com\/invite|discord\.com\/invites)\/[a-zA-Z0-9]+/g;
    const matches = message.content.match(inviteRegex);

    if (!matches) return;

    // 検出されたリンク（正規化して比較用に保持）
    const inviteLink = matches[0];
    const userId = message.author.id;
    const now = Date.now();

    // キャッシュキー（サーバーID + ユーザーID + リンク）
    const cacheKey = `${guildId}-${userId}-${inviteLink}`;

    if (!messageCache.has(cacheKey)) {
      messageCache.set(cacheKey, []);
    }

    const timestamps = messageCache.get(cacheKey);
    // 3秒以内の履歴だけを残す
    const recentTimestamps = timestamps.filter(t => now - t < 3000);
    recentTimestamps.push(now);
    messageCache.set(cacheKey, recentTimestamps);

    // 3秒以内に3回同じリンクが投稿された場合
    if (recentTimestamps.length >= 3) {
      messageCache.delete(cacheKey); // キャッシュクリア

      try {
        // 1. メッセージの削除
        if (message.deletable) {
          await message.delete().catch(() => {});
        }

        // 2. タイムアウトの付与 (10分間)
        const member = await message.guild.members.fetch(userId).catch(() => null);
        let timeoutSuccess = false;
        if (member && member.moderatable) {
          await member.timeout(10 * 60 * 1000, '3秒以内に同じ招待リンクを3回連投したため（荒らし対策）');
          timeoutSuccess = true;
        }

        // 3. ログチャンネルへの通知
        const logChannelId = antiConfig.logChannelId;
        const logChannel = message.guild.channels.cache.get(logChannelId);

        if (logChannel) {
          // Botの場合は全体メンションを含める
          const mentionText = message.author.bot ? '@everyone\n' : '';
          const timeoutText = timeoutSuccess ? '10分間のタイムアウトを適用しました。' : '⚠️ 権限不足またはロール階層の影響でタイムアウトを付与できませんでした。';

          const logEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 荒らし（招待リンク連投）を検知しました')
            .setDescription(`${mentionText}ユーザー: <@${userId}> (${message.author.tag})\nチャンネル: <#${message.channel.id}>\n内容: 3秒以内に同じ招待リンクを3回連投\n処置: メッセージ削除 ＆ ${timeoutText}`)
            .setTimestamp();

          const sentMsg = await logChannel.send({ embeds: [logEmbed] }).catch(() => null);

          // 10秒後にログを自動消去する
          if (sentMsg) {
            setTimeout(async () => {
              await sentMsg.delete().catch(() => {});
            }, 10000);
          }
        }
      } catch (err) {
        console.error('荒らし対策処理エラー:', err);
      }
    }
  }
};
