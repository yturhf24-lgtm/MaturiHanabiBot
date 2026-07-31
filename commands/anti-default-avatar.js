const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anti-default-avatar')
    .setDescription('【特別ユーザー・サーバーオーナー専用】初期アイコンの参加者を自動でKickします')
    // 必須オプションを先に配置
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
    .addStringOption(option =>
      option.setName('kick-action')
        .setDescription('Kickを実行するかどうか')
        .setRequired(true)
        .addChoices({ name: 'Kickする', value: 'yes' }, { name: 'Kickしない（ログのみ）', value: 'no' })
    )
    // 任意オプションを後ろに配置
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
    const kickAction = interaction.options.getString('kick-action') === 'yes';
    const mentionRole = interaction.options.getRole('mention-role');
    const guildId = interaction.guildId;

    const settings = client.getSettings();
    if (!settings[guildId]) settings[guildId] = {};

    settings[guildId].antiDefaultAvatar = {
      enabled: status === 'on',
      logChannelId: logChannel.id,
      mentionRoleId: mentionRole ? mentionRole.id : null,
      kick: kickAction
    };
    await client.saveSettings(settings);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(status === 'on' ? 0x00FF00 : 0xFF0000)
          .setTitle(`🐣 初期アイコン対策: ${status.toUpperCase()}`)
          .setDescription(`ログチャンネル: <#${logChannel.id}>\nKick実行: ${kickAction ? '有効' : '無効'}\nメンション: ${mentionRole ? `<@&${mentionRole.id}>` : 'なし'}`)
      ]
    });
  },

  async handleMemberAdd(member, client) {
    const settings = client.getSettings();
    const config = settings[member.guild.id]?.antiDefaultAvatar;
    if (!config || !config.enabled) return;

    if (!member.user.avatar) {
      try {
        if (config.kick && member.kickable) {
          await member.kick('初期アイコン自動Kick');
        }

        const logChannel = member.guild.channels.cache.get(config.logChannelId);
        if (logChannel) {
          const mentionText = config.mentionRoleId ? `<@&${config.mentionRoleId}>\n` : '';
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🐣 初期アイコンユーザー検知')
            .setDescription(`${mentionText}ユーザー: <@${member.id}>\n処置: ${config.kick ? 'Kickしました' : '検知のみ'}`)
            .setTimestamp();
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (err) {
        console.error('エラー:', err);
      }
    }
  }
};
