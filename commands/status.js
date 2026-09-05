const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

// 実行を許可する特定ユーザーのID
const ALLOWED_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('現在のBot設定状態を確認します（許可されたユーザーのみ）'),

  async execute(interaction, globalConfig = {}) {
    // 実行権限チェック（指定ID または サーバー所有者）
    const isOwner = interaction.guild.ownerId === interaction.user.id;
    const isAllowedUser = interaction.user.id === ALLOWED_USER_ID;

    if (!isOwner && !isAllowedUser) {
      return interaction.reply({
        content: '❌ このコマンドを実行する権限がありません。',
        flags: MessageFlags.Ephemeral
      });
    }

    const guildId = interaction.guildId;
    const cfg = globalConfig[guildId] || {};

    // 1. ロール自動制御設定
    const roleControlStatus = cfg.enabled ? '🟢 動作中' : '🔴 停止中';
    const conditionRole = cfg.conditionRoleId ? `<@&${cfg.conditionRoleId}>` : '未設定';
    const removeRoles = (cfg.removeRoleIds && cfg.removeRoleIds.length > 0) 
      ? cfg.removeRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし';
    const addRoles = (cfg.addRoleIds && cfg.addRoleIds.length > 0) 
      ? cfg.addRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし';
    const roleLogChannel = cfg.logChannelId ? `<#${cfg.logChannelId}>` : '未設定';
    const restartNotify = cfg.restartNotify ? '🔔 ON' : '🔕 OFF';

    // 2. 条件ロール自動付与設定
    const addRoleCfg = cfg.addRoleConfig || {};
    const addRoleStatus = addRoleCfg.enabled ? '🟢 動作中' : '🔴 停止中';
    const excludeRoles = (addRoleCfg.excludeRoleIds && addRoleCfg.excludeRoleIds.length > 0) 
      ? addRoleCfg.excludeRoleIds.map(id => `<@&${id}>`).join(', ') : 'なし（全員対象）';
    const targetRoles = (addRoleCfg.targetRoleIds && addRoleCfg.targetRoleIds.length > 0) 
      ? addRoleCfg.targetRoleIds.map(id => `<@&${id}>`).join(', ') : '未設定';
    const addRoleLogChannel = addRoleCfg.logChannelId ? `<#${addRoleCfg.logChannelId}>` : '未設定';

    // 3. 数字カウンター設定
    const countCfg = cfg.countConfig || {};
    const countStatus = countCfg.enabled ? '🟢 動作中' : '🔴 停止中';
    const countChannel = countCfg.channelId ? `<#${countCfg.channelId}>` : '未設定';
    const currentNum = countCfg.currentNum ?? 0;
    const deleteWrong = (countCfg.deleteWrong !== false) ? '✅ 有効' : '❌ 無効';
    const warnEmbed = (countCfg.warnEmbed !== false) ? '✅ 有効' : '❌ 無効';

    const embed = new EmbedBuilder()
      .setTitle(`📊 現在のBot設定ステータス (${interaction.guild.name})`)
      .setColor(0x3498db)
      .addFields(
        {
          name: '🛡️ 1. ロール自動制御',
          value: 
            `> **ステータス:** ${roleControlStatus}\n` +
            `> **条件ロール:** ${conditionRole}\n` +
            `> **自動削除:** ${removeRoles}\n` +
            `> **自動付与:** ${addRoles}\n` +
            `> **ログ先:** ${roleLogChannel}\n` +
            `> **再起動通知:** ${restartNotify}`,
          inline: false
        },
        {
          name: '➕ 2. 条件ロール自動付与',
          value: 
            `> **ステータス:** ${addRoleStatus}\n` +
            `> **除外ロール:** ${excludeRoles}\n` +
            `> **付与ロール:** ${targetRoles}\n` +
            `> **ログ先:** ${addRoleLogChannel}`,
          inline: false
        },
        {
          name: '🔢 3. 数字カウンター',
          value: 
            `> **ステータス:** ${countStatus}\n` +
            `> **対象チャンネル:** ${countChannel}\n` +
            `> **現在のカウント:** **\`${currentNum}\`**\n` +
            `> **誤爆自動削除:** ${deleteWrong}\n` +
            `> **警告メッセージ:** ${warnEmbed}`,
          inline: false
        }
      )
      .setFooter({ text: '※このメッセージはあなただけに表示されています' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};
