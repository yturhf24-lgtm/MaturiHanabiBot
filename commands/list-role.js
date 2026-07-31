const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-role')
    .setDescription('【特別ユーザー・サーバーオーナー専用】現在許可されているロールの一覧を表示します'),

  async execute(interaction, client) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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

    const guildId = interaction.guildId;
    const settings = client.getSettings();
    const allowedRoles = settings[guildId]?.allowedRoles || [];

    if (allowedRoles.length === 0) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle('📋 許可ロール一覧')
            .setDescription('現在登録されている許可ロールはありません。')
        ]
      });
    }

    const roleList = allowedRoles.map(roleId => `<@&${roleId}>`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📋 許可ロール一覧')
      .setDescription(roleList)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
