const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require('discord.js');
const { allowedUserIds } = require('../config');

function formatDate(date) {
  return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

function countChannelsByType(guild, type) {
  return guild.channels.cache.filter((channel) => channel.type === type).size;
}

function canUseCommand(interaction) {
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  const isAllowedUser = allowedUserIds.has(interaction.user.id);
  return isAdmin || isAllowedUser;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('サーバー情報')
    .setDescription('このサーバーの情報を埋め込みで表示します')
    .setDMPermission(false),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({
        content: 'このコマンドはサーバー内でのみ使用できます。',
        ephemeral: true,
      });
    }

    if (!canUseCommand(interaction)) {
      return interaction.reply({
        content: 'このコマンドを使えるのは、サーバー管理者または許可されたユーザーのみです。',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const guild = interaction.guild;
    const owner = await guild.fetchOwner().catch(() => null);
    const fullGuild = await guild.fetch().catch(() => guild);

    const embed = new EmbedBuilder()
      .setColor(0x2f80ed)
      .setTitle(`${guild.name} のサーバー情報`)
      .setThumbnail(guild.iconURL({ size: 256 }))
      .addFields(
        {
          name: '基本情報',
          value: [
            `サーバー名: ${guild.name}`,
            `サーバーID: ${guild.id}`,
            `オーナー: ${owner ? `${owner.user.tag} (${owner.id})` : '取得できませんでした'}`,
            `作成日: ${formatDate(guild.createdAt)}`,
          ].join('\n'),
        },
        {
          name: '人数',
          value: [
            `メンバー数: ${guild.memberCount.toLocaleString()} 人`,
            `ブースト数: ${fullGuild.premiumSubscriptionCount ?? 0}`,
            `ブーストレベル: ${fullGuild.premiumTier}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: 'チャンネル',
          value: [
            `テキスト: ${countChannelsByType(guild, ChannelType.GuildText)}`,
            `ボイス: ${countChannelsByType(guild, ChannelType.GuildVoice)}`,
            `カテゴリ: ${countChannelsByType(guild, ChannelType.GuildCategory)}`,
            `フォーラム: ${countChannelsByType(guild, ChannelType.GuildForum)}`,
            `告知: ${countChannelsByType(guild, ChannelType.GuildAnnouncement)}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: 'その他',
          value: [
            `ロール数: ${guild.roles.cache.size}`,
            `絵文字数: ${guild.emojis.cache.size}`,
            `ステッカー数: ${guild.stickers.cache.size}`,
          ].join('\n'),
          inline: true,
        },
      )
      .setFooter({
        text: `実行者: ${interaction.user.tag}`,
        iconURL: interaction.user.displayAvatarURL({ size: 128 }),
      })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  },
};
