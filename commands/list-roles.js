const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-roles')
    .setDescription('【管理者専用】現在登録されているBotの操作許可ロール一覧を表示します'),

  async execute(interaction) {
    // 💡 サーバーの「管理者（Administrator）」権限を持っているか厳格にチェック
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 権限エラー')
            .setDescription('このコマンドは管理者のみの設定です。')
        ],
        ephemeral: true
      });
    }

    await interaction.deferReply();

    const settings = interaction.client.getSettings();
    const roles = settings[interaction.guildId]?.roles || [];

    if (roles.length === 0) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFFFF00).setDescription('現在、このサーバーに登録されている許可ロールはありません。')]
      });
    }

    const roleMentions = roles.map(id => `<@&${id}>`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x00FFFF)
      .setTitle('📋 許可ロール一覧')
      .setDescription(`以下のロールを持つユーザーは、管理権限がなくてもBotの一部管理コマンドを実行できます。\n\n${roleMentions}`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
