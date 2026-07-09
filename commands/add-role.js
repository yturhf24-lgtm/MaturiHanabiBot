const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('【管理者専用】Botの操作を許可するロールを追加します（結果はあなたにしか見えません）')
    .addRoleOption(option =>
      option.setName('role').setDescription('許可するロールを選択').setRequired(true)
    ),

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
    await interaction.client.saveSettings(settings);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ 許可ロール追加')
      .setDescription(`<@&${role.id}> をBotの操作許可リストに追加しました。`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
