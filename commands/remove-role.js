const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

const SPECIAL_USER_ID = '1266013271518089258';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove-role')
    .setDescription('【管理者・特別ユーザー専用】Botの操作許可リストからロールを削除します')
    .addRoleOption(option =>
      option.setName('role').setDescription('削除するロールを選択').setRequired(true)
    ),

  async execute(interaction) {
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
    const dbKey = `allowed_roles_${guildId}`;

    let currentRoles = await db.get(dbKey) || [];

    const index = currentRoles.indexOf(role.id);
    if (index === -1) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFFF00)
            .setDescription(`<@&${role.id}> は許可リストに登録されていません。`)
        ]
      });
    }

    currentRoles.splice(index, 1);
    await db.set(dbKey, currentRoles);

    const embed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle('🗑️ 許可ロール削除')
      .setDescription(`<@&${role.id}> をBotの操作許可リストから削除しました。`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
