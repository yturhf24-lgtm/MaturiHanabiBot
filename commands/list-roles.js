const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-roles')
    .setDescription('【管理者専用】現在登録されている許可ロール一覧を表示します（あなたにしか見えません）'),

  async execute(interaction) {
    // 1. 権限チェック
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 権限エラー')
            .setDescription('このコマンドは管理者のみの設定です。')
        ],
        flags: [MessageFlags.Ephemeral]
      });
    }

    // 💡 応答を「自分だけに見える状態」で準備する
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

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
