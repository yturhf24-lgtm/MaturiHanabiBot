const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

const SPECIAL_USER_ID = '1266013271518089258';
const DATA_FILE = path.join(__dirname, '../data.json');

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

    let settings = {};
    try {
      if (fs.existsSync(DATA_FILE)) {
        settings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (error) {
      settings = {};
    }

    if (!settings[guildId] || !Array.isArray(settings[guildId].roles)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFFF00)
            .setDescription('このサーバーには登録されている許可ロールがありません。')
        ]
      });
    }

    const index = settings[guildId].roles.indexOf(role.id);
    if (index === -1) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFFF00)
            .setDescription(`<@&${role.id}> は許可リストに登録されていません。`)
        ]
      });
    }

    // リストから削除して即座に data.json へ保存
    settings[guildId].roles.splice(index, 1);

    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (error) {
      console.error('data.json の保存エラー:', error);
      return interaction.editReply({ content: '⚠️ データの保存中にエラーが発生しました。' });
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF9900)
      .setTitle('🗑️ 許可ロール削除')
      .setDescription(`<@&${role.id}> をBotの操作許可リストから削除しました。`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
