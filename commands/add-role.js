const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const fs = require('fs');
const path = require('path');

const SPECIAL_USER_ID = '1266013271518089258';
const DATA_FILE = path.join(__dirname, '../data.json'); // ルートディレクトリにある data.json を指定

module.exports = {
  data: new SlashCommandBuilder()
    .setName('add-role')
    .setDescription('【管理者・特別ユーザー専用】Botの操作を許可するロールを追加します')
    .addRoleOption(option =>
      option.setName('role').setDescription('許可するロールを選択').setRequired(true)
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

    // 1. data.json を直接読み込む（ファイルがなければ空のオブジェクトを作成）
    let settings = {};
    try {
      if (fs.existsSync(DATA_FILE)) {
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        settings = JSON.parse(fileData);
      }
    } catch (error) {
      console.error('data.json の読み込みエラー:', error);
      settings = {};
    }

    // 2. サーバーごとのデータ構造がなければ初期化
    if (!settings[guildId]) {
      settings[guildId] = { roles: [] };
    }
    if (!Array.isArray(settings[guildId].roles)) {
      settings[guildId].roles = [];
    }

    // 3. 既に登録されているか確認
    if (settings[guildId].roles.includes(role.id)) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFFF00)
            .setDescription(`すでに <@&${role.id}> は許可リストに登録されています。`)
        ]
      });
    }

    // 4. ロールを追加して data.json へ即座に書き込み保存
    settings[guildId].roles.push(role.id);
    
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (error) {
      console.error('data.json の保存エラー:', error);
      return interaction.editReply({
        content: '⚠️ データの保存中にエラーが発生しました。'
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('✅ 許可ロール追加')
      .setDescription(`<@&${role.id}> をBotの操作許可リストに追加しました。`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
