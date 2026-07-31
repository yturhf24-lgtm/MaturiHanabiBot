const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-role')
    .setDescription('【特別ユーザー・サーバーオーナー専用】Botの操作を許可するロールを削除します')
    .addRoleOption(option =>
      option.setName('role').setDescription('削除するロールを選択').setRequired(true)
    ),

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

    const role = interaction.options.getRole('role');
    const guildId = interaction.guildId;
    const settings = client.getSettings();

    if (!settings[guildId] || !Array.isArray(settings[guildId].allowedRoles)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFFF00)
            .setDescription('登録されている許可ロールはありません。')
        ]
      });
    }

    const index = settings[guildId].allowedRoles.indexOf(role.id);
    if (index === -1) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFFF00)
            .setDescription(`<@&${role.id}> は許可リストに登録されていません。`)
        ]
      });
    }

    settings[guildId].allowedRoles.splice(index, 1);
    await client.saveSettings(settings);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🗑️ 許可ロール削除')
      .setDescription(`<@&${role.id}> をBotの操作許可リストから削除しました。`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
