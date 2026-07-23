const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_antiraid')
    .setDescription('荒らし対策機能の一括ステータス確認と設定')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 1️⃣ 一括ステータス確認
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('すべての荒らし対策機能のON/OFF設定を一括確認します')
    )
    // 2️⃣ 捨て垢自動防衛の設定変更
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('捨て垢自動防衛（自動キック）の設定を変更します')
        .addStringOption(option =>
          option
            .setName('status')
            .setDescription('機能のON/OFF')
            .setRequired(true)
            .addChoices({ name: 'ON', value: 'ON' }, { name: 'OFF', value: 'OFF' })
        )
        .addIntegerOption(option =>
          option
            .setName('min_age_days')
            .setDescription('キック対象とする作成日数（日）')
            .setRequired(false)
        )
        .addBooleanOption(option =>
          option
            .setName('block_no_avatar')
            .setDescription('初期アイコンを自動キックするか')
            .setRequired(false)
        )
    ),

  async execute(interaction, client) {
    // レスポンスの遅延（タイムアウト防止）
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => null);
    
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const db = client.db;

    if (!db) {
      return interaction.editReply({
        content: '❌ データベースが初期化されていません。index.js を確認してください。'
      }).catch(() => null);
    }

    // -------------------------------------------------------------
    // パターンA: `/v_antiraid status`（すべての荒らし対策を一括確認）
    // -------------------------------------------------------------
    if (subcommand === 'status') {
      try {
        // DBから安全に各機能の設定を取得
        const rawAntiraid = await db.get(`antiraid_${guildId}`);
        const rawAntiwebhook = await db.get(`antiwebhook_${guildId}`);
        const rawAntieveryone = await db.get(`antieveryone_${guildId}`);
        const rawAntilink = await db.get(`antilink_${guildId}`);
        const rawAntispam = await db.get(`antispam_${guildId}`);
        const rawRisklog = await db.get(`risklog_${guildId}`);
        const rawLog = await db.get(`log_${guildId}`);

        // DBの型ブレ（文字列 / オブジェクト）を吸収して確実にON/OFF判定する関数
        const parseStatus = (data) => {
          if (!data) return 'OFF';
          if (typeof data === 'string') return data.toUpperCase() === 'ON' ? 'ON' : 'OFF';
          if (typeof data === 'object') return data.status === 'ON' ? 'ON' : 'OFF';
          return 'OFF';
        };

        const formatStatus = (data) => (parseStatus(data) === 'ON' ? '🟢 **ON (有効)**' : '🔴 **OFF (無効)**');

        // antiraidの詳細設定を取得
        const minAge = (typeof rawAntiraid === 'object' && rawAntiraid?.min_age_days) ? rawAntiraid.min_age_days : 3;
        const blockNoAvatar = (typeof rawAntiraid === 'object' && rawAntiraid?.block_no_avatar) ? rawAntiraid.block_no_avatar : false;
        const logChannelId = (typeof rawLog === 'object' && rawLog?.channelId) ? rawLog.channelId : null;

        const statusEmbed = new EmbedBuilder()
          .setTitle('🛡️ サーバー荒らし・セキュリティ対策ステータス')
          .setDescription('現在のサーバーセキュリティ機能の ON / OFF 設定一覧です。')
          .setColor(0x3498DB)
          .addFields(
            {
              name: '🤖 捨て垢自動防衛 (Auto-Kick)',
              value: `${formatStatus(rawAntiraid)}\n└ 条件: 作成 **${minAge}日未満** / 初期アイコン自動キック: **${blockNoAvatar ? '有効' : '無効'}**`,
              inline: false
            },
            { name: '🔗 Webhookスパム防御', value: formatStatus(rawAntiwebhook), inline: true },
            { name: '📢 @everyone 乱用対策', value: formatStatus(rawAntieveryone), inline: true },
            { name: '🌐 連続リンク投稿制限', value: formatStatus(rawAntilink), inline: true },
            { name: '⚡ 簡易スパム連投対策', value: formatStatus(rawAntispam), inline: true },
            { name: '⚠️ リスクアカウント参加警告', value: formatStatus(rawRisklog), inline: true },
            {
              name: '📜 ログ出力機能',
              value: `${formatStatus(rawLog)}\n└ 送信先: ${logChannelId ? `<#${logChannelId}>` : '未設定'}`,
              inline: false
            }
          )
          .setFooter({ text: '個別の設定変更は各種設定コマンドを実行してください' })
          .setTimestamp();

        return await interaction.editReply({ embeds: [statusEmbed] });
      } catch (err) {
        console.error('Status表示エラー:', err);
        return await interaction.editReply({ content: '❌ ステータスの取得中にエラーが発生しました。' });
      }
    }

    // -------------------------------------------------------------
    // パターンB: `/v_antiraid set`（捨て垢防衛の設定変更）
    // -------------------------------------------------------------
    if (subcommand === 'set') {
      try {
        const rawAntiraid = (await db.get(`antiraid_${guildId}`)) || {};
        const currentData = typeof rawAntiraid === 'object' ? rawAntiraid : {};

        const newStatus = interaction.options.getString('status');
        const newMinAge = interaction.options.getInteger('min_age_days') ?? currentData.min_age_days ?? 3;
        const newBlockNoAvatar = interaction.options.getBoolean('block_no_avatar') ?? currentData.block_no_avatar ?? false;

        // データを整理してDBに確実に保存
        const updatedSettings = {
          status: newStatus,
          min_age_days: newMinAge,
          block_no_avatar: newBlockNoAvatar
        };

        await db.set(`antiraid_${guildId}`, updatedSettings);

        const isEnabled = newStatus === 'ON';

        const updateEmbed = new EmbedBuilder()
          .setTitle('🤖 捨て垢自動防衛 - 設定更新')
          .setColor(isEnabled ? 0x2ECC71 : 0xE74C3C)
          .addFields(
            { name: '⚡ 動作ステータス', value: isEnabled ? '🟢 **ON (有効)**' : '🔴 **OFF (無効)**' },
            { name: '📅 アカウント作成日数制限', value: `作成から **${newMinAge}日未満** を自動キック` },
            { name: '🖼️ 初期アイコン制限', value: newBlockNoAvatar ? '🚫 **ブロックする (自動キック)**' : '⚪ **許可する**' }
          )
          .setTimestamp();

        return await interaction.editReply({ embeds: [updateEmbed] });
      } catch (err) {
        console.error('Antiraid設定保存エラー:', err);
        return await interaction.editReply({ content: '❌ 設定の保存中にエラーが発生しました。' });
      }
    }
  }
};
