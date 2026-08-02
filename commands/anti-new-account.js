const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ChannelType } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('anti-new-account')
    .setDescription('【特別ユーザー・サーバーオーナー専用】指定日数未満のアカウントの参加を制限します')
    // 必須オプション
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
      option.setName('max-days')
        .setDescription('この日数未満のアカウントを対象にする')
        .setRequired(true)
    )
    // 任意オプション
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
    const maxDays = interaction.options.getInteger('max-days');
    const mentionRole = interaction.options.getRole('mention-role');
    const guildId = interaction.guildId;

    const settings = client.getSettings();
    if (!settings[guildId]) settings[guildId] = {};

    settings[guildId].antiNewAccount = {
      enabled: status === 'on',
      logChannelId: logChannel.id,
      maxDays,
      mentionRoleId: mentionRole ? mentionRole.id : null
    };
    await client.saveSettings(settings);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(status === 'on' ? 0x00FF00 : 0xFF0000)
          .setTitle(`📅 新規アカウント対策: ${status.toUpperCase()}`)
          .setDescription(`対象: ${maxDays}日未満のアカウント\nログ: <#${logChannel.id}>\nメンション: ${mentionRole ? `<@&${mentionRole.id}>` : 'なし'}`)
      ]
    });
  },

  async handleMemberAdd(member, client) {
    const settings = client.getSettings();
    const config = settings[member.guild.id]?.antiNewAccount;
    if (!config || !config.enabled) return;

    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);

    if (accountAgeDays < config.maxDays) {
      try {
        if (member.kickable) {
          await member.kick('新規アカウント自動Kick');
        }

        const logChannel = member.guild.channels.cache.get(config.logChannelId);
        if (logChannel) {
          const mentionText = config.mentionRoleId ? `<@&${config.mentionRoleId}>\n` : '';
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('📅 新規アカウント自動Kick')
            .setDescription(`${mentionText}ユーザー: <@${member.id}>\n作成経過日数: ${Math.floor(accountAgeDays)}日`)
            .setTimestamp();
          await logChannel.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (err) {
        console.error('エラー:', err);
      }
    }
  }
};
