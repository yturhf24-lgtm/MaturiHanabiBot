const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('【管理者専用】Botの操作を許可するロールを追加します')
    .addRoleOption(option =>
      option.setName('role').setDescription('許可するロールを選択').setRequired(true)
    ),

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
        ephemeral: true // 実行した一般ユーザーにしか見えないエラー
      });
    }

    await interaction.deferReply();

    const role = interaction.options.getRole('role');
    const settings = interaction.client.getSettings();

    if (!settings[interaction.guildId]) {
      settings[interaction.guildId] = { roles: [] };
    }

    if (settings[interaction.guildId].roles.includes(role.id)) {
      return interaction.editReply({
        embeds: [new EmbedBuilder().setColor(0xFFFF00).setDescription(`すでに <@&${role.id}> は許可リストに登録されています。`)]
      });
    }

    settings[interaction.guildId].roles.push(role.id);
    interaction.client.saveSettings(settings);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ 許可ロール追加')
      .setDescription(`<@&${role.id}> をBotの操作許可リストに追加しました。`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
