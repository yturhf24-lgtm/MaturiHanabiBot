const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('【管理者・特別ユーザー専用】Botの操作を許可するロールを追加します')
    .addRoleOption(option =>
      option.setName('role').setDescription('許可するロールを選択').setRequired(true)
    ),

  async execute(interaction, client) {
    const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
    const isSpecialUser = interaction.user.id === SPECIAL_USER_ID;

    if (!isAdmin && !isSpecialUser) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ 権限エラー')
            .setDescription('このコマンドは管理者または指定プレイヤーのみ実行可能です。')
        ],
        flags: [MessageFlags.Ephemeral]
      });
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const role = interaction.options.getRole('role');
    const guildId = interaction.guildId;

    const settings = client.getSettings();

    if (!settings[guildId]) {
      settings[guildId] = { allowedRoles: [] };
    }
    if (!Array.isArray(settings[guildId].allowedRoles)) {
      settings[guildId].allowedRoles = [];
    }

    if (settings[guildId].allowedRoles.includes(role.id)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFFF00)
            .setDescription(`すでに <@&${role.id}> は許可リストに登録されています。`)
        ]
      });
    }

    settings[guildId].allowedRoles.push(role.id);
    await client.saveSettings(settings);

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ 許可ロール追加')
      .setDescription(`<@&${role.id}> をBotの操作許可リストに追加しました。`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
