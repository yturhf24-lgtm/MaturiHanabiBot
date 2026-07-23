const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_antiraid')
    .setDescription('荒らし対策機能の一括ステータス確認と設定')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 1️⃣ 一括設定確認用サブコマンド
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('すべての荒らし対策機能のON/OFF設定を一括確認します')
    )
    // 2️⃣ 個別設定変更用サブコマンド
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
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => null);
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // -------------------------------------------------------------
    // パターンA: `/v_antiraid status`（すべての荒らし対策を一括確認）
    // -------------------------------------------------------------
    if (subcommand === 'status') {
      // 各機能の設定をDBから平行して取得（未設定の場合はOFF/デフォルト値を適用）
      const [
        antiraid,
        antiwebhook,
        antieveryone,
        antilink,
        antispam,
        risklog,
        log
      ] = await Promise.all([
        client.db?.get(`antiraid_${guildId}`) || { status: 'OFF', min_age_days: 3, block_no_avatar: false },
        client.db?.get(`antiwebhook_${guildId}`) || { status: 'OFF' },
        client.db?.get(`antieveryone_${guildId}`) || { status: 'OFF' },
        client.db?.get(`antilink_${guildId}`) || { status: 'OFF' },
        client.db?.get(`antispam_${guildId}`) || { status: 'OFF' },
        client.db?.get(`risklog_${guildId}`) || { status: 'OFF' },
        client.db?.get(`log_${guildId}`) || { status: 'OFF', channelId: null }
      ]);

      // ON / OFF の表示用ヘルパー関数
      const formatStatus = (status) => (status === 'ON' ? '🟢 **ON (有効)**' : '🔴 **OFF (無効)**');

      const statusEmbed = new EmbedBuilder()
        .setTitle('🛡️ サーバー荒らし・セキュリティ対策ステータス')
        .setDescription('現在のサーバーセキュリティ機能の ON / OFF 設定一覧です。')
        .setColor(0x3498DB)
        .addFields(
          {
            name: '🤖 捨て垢自動防衛 (Auto-Kick)',
            value: `${formatStatus(antiraid.status)}\n└ 条件: 作成 **${antiraid.min_age_days ?? 3}日未満** / 初期アイコン自動キック: **${antiraid.block_no_avatar ? '有効' : '無効'}**`,
            inline: false
          },
          {
            name: '🔗 Webhookスパム防御',
            value: formatStatus(antiwebhook.status),
            inline: true
          },
          {
            name: '📢 @everyone / @here 乱用対策',
            value: formatStatus(antieveryone.status),
            inline: true
          },
          {
            name: '🌐 連続リンク投稿制限',
            value: formatStatus(antilink.status),
            inline: true
          },
          {
            name: '⚡ 簡易スパム連投対策',
            value: formatStatus(antispam.status),
            inline: true
          },
          {
            name: '⚠️ リスクアカウント参加警告',
            value: formatStatus(risklog.status),
            inline: true
          },
          {
            name: '📜 ログ出力機能',
            value: `${formatStatus(log.status)}\n└ 送信先: ${log.channelId ? `<#${log.channelId}>` : '未設定'}`,
            inline: false
          }
        )
        .setFooter({ text: '個別の設定変更は各コマンド（/v_antiraid set, /v_log set など）を実行してください' })
        .setTimestamp();

      return interaction.editReply({ embeds: [statusEmbed] }).catch(() => null);
    }

    // -------------------------------------------------------------
    // パターンB: `/v_antiraid set`（捨て垢防衛の設定更新）
    // -------------------------------------------------------------
    if (subcommand === 'set') {
      let currentSettings = (await client.db?.get(`antiraid_${guildId}`)) || {
        status: 'OFF',
        min_age_days: 3,
        block_no_avatar: false
      };

      const newStatus = interaction.options.getString('status');
      const newMinAge = interaction.options.getInteger('min_age_days') ?? currentSettings.min_age_days ?? 3;
      const newBlockNoAvatar = interaction.options.getBoolean('block_no_avatar') ?? currentSettings.block_no_avatar ?? false;

      const updatedSettings = {
        status: newStatus,
        min_age_days: newMinAge,
        block_no_avatar: newBlockNoAvatar
      };

      await client.db?.set(`antiraid_${guildId}`, updatedSettings);

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

      return interaction.editReply({ embeds: [updateEmbed] }).catch(() => null);
    }
  }
};
