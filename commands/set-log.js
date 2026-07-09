const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');

const MASTER_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('set-log')
    .setDescription('参加・退出ログの通知チャンネルとカスタムメッセージを設定します')
    .addChannelOption(option =>
      option.setName('channel').setDescription('通知を送信するテキストチャンネル').setRequired(true).addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(option =>
      option.setName('join-message').setDescription('参加時のメッセージ（{user}でメンション）').setRequired(false)
    )
    .addStringOption(option =>
      option.setName('leave-message').setDescription('退出時のメッセージ（{user}でメンション）').setRequired(false)
    ),

  async execute(interaction) {
    // 🔐 権限チェック（マスターユーザー、管理者、または許可ロール持ち）
    const isMasterUser = interaction.user.id === MASTER_USER_ID;
    const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
    const settings = interaction.client.getSettings();
    const allowedRoles = settings[interaction.guildId]?.roles || [];
    const hasAllowedRole = interaction.member.roles.cache.some(role => allowedRoles.includes(role.id));

    if (!isMasterUser && !isAdmin && !hasAllowedRole) {
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 権限エラー').setDescription('このコマンドを使用する権限がありません。')],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const channel = interaction.options.getChannel('channel');
    const joinMsg = interaction.options.getString('join-message') || '**{user}** がサーバーに参加しました！';
    const leaveMsg = interaction.options.getString('leave-message') || '**{user}** がサーバーから退出しました。';

    if (!settings[interaction.guildId]) {
      settings[interaction.guildId] = { roles: [] };
    }

    // 設定をまとめて保存
    settings[interaction.guildId].logChannel = channel.id;
    settings[interaction.guildId].joinMessage = joinMsg;
    settings[interaction.guildId].leaveMessage = leaveMsg;

    await interaction.client.saveSettings(settings);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('⚙️ ログ通知システム設定完了')
      .setDescription('以下の内容で「設定画面UI」を構築しました。')
      .addFields(
        { name: '📺 通知先チャンネル', value: `<#${channel.id}>`, inline: false },
        { name: '📥 カスタム参加メッセージ', value: `\`\`\`${joinMsg}\`\`\``, inline: false },
        { name: '📤 カスタム退出メッセージ', value: `\`\`\`${leaveMsg}\`\`\``, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: `設定変更者: ${interaction.user.tag}` });

    await interaction.editReply({ embeds: [embed] });
  },
};
