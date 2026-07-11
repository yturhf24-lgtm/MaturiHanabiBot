const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } = require('discord.js');
const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-log')
    .setDescription('認証詳細ログの送信先チャンネルを1つ設定します')
    .addChannelOption(option => option.setName('channel').setDescription('ログを送信するチャンネル').setRequired(true))
    .addStringOption(option => option.setName('status').setDescription('オンかオフを選択').setRequired(true).addChoices(
      { name: 'ON', value: 'on' },
      { name: 'OFF', value: 'off' }
    )),

  async execute(interaction) {
    const isMasterUser = interaction.user.id === MASTER_USER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];
    const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!isMasterUser && !isAdmin && !hasAllowedRole) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('このコマンドを使用する権限がありません。')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const channel = interaction.options.getChannel('channel');
    const status = interaction.options.getString('status');

    if (!settings[interaction.guildId]) settings[interaction.guildId] = {};
    
    const currentChannel = settings[interaction.guildId].vLogChannel;
    const currentStatus = settings[interaction.guildId].vLogStatus;

    // 💡 同一チャンネルかつすでにONの場合のエラーガード
    if (status === 'on' && currentStatus === true && currentChannel === channel.id) {
      return interaction.reply({
        content: `⚠️ **同じチャンネル（ <#${channel.id}> ）に設定しています。**`,
        flags: [MessageFlags.Ephemeral]
      });
    }

    // 💡 常に新しいチャンネルデータに上書き保存
    settings[interaction.guildId].vLogChannel = channel.id;
    settings[interaction.guildId].vLogStatus = (status === 'on');
    await interaction.client.saveSettings(settings);

    // 💡 安全対策：すでに返信済みの場合は処理を中断して二重返信(40060)を防ぐ
    if (interaction.replied || interaction.deferred) return;

    await interaction.reply({
      content: `✅ このサーバーの認証ログを <#${channel.id}> で **${status.toUpperCase()}** に設定しました。\n(新しく設定されたため、今後はこのチャンネルにのみ返信・転送されます)`,
      flags: [MessageFlags.Ephemeral]
    });
  },
};
