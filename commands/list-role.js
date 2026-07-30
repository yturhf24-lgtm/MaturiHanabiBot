const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const SPECIAL_USER_ID = '1266013271518089258';
const DATA_FILE = path.resolve(__dirname, '../data.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('list-role')
    .setDescription('現在登録されている操作許可ロールの一覧を表示します'),

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

    let settings = {};
    try {
      if (fs.existsSync(DATA_FILE)) {
        settings = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      }
    } catch (e) {
      settings = {};
    }

    const guildId = interaction.guildId;
    const allowedRoles = settings[guildId]?.allowedRoles || [];

    if (allowedRoles.length === 0) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFFF00)
            .setTitle('📋 許可ロール一覧')
            .setDescription('現在、このサーバーに登録されている許可ロールはありません。')
        ],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const roleListText = allowedRoles.map(roleId => `<@&${roleId}>`).join('\n');

    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📋 操作許可ロール一覧')
      .setDescription(roleListText)
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
  },
};
