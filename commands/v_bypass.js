const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_bypass')
    .setDescription('【管理者専用】指定したユーザーの裏アカウント制限を許可または削除します。')
    // 🛑 管理者権限（Administrator）を持たないユーザーにはコマンドの使用・表示を一切禁止する
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // 💡 DM（ダイレクトメッセージ）でのコマンド実行を防ぐ（サーバー内限定）
    .setDMPermission(false)
    .addUserOption(option => 
      option.setName('target').setDescription('対象のユーザーを選択').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('action')
        .setDescription('行う操作を選択')
        .setRequired(true)
        .addChoices(
          { name: '許可（裏垢チェックを免除）', value: 'allow' },
          { name: '削除（免除を解除して制限に戻す）', value: 'remove' }
        )
    ),

  async execute(interaction) {
    // 🛑 二重チェック: 万が一権限のすり抜けがあった場合に備え、コード上でも管理者か厳格に判定
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ 
        content: '❌ このコマンドはサーバーの最高管理者（管理者権限を付与されたロール）のみ実行可能です。許可ロール等では使用できません。', 
        ephemeral: true 
      });
    }

    const target = interaction.options.getUser('target');
    const action = interaction.options.getString('action');
    const guildId = interaction.guildId;

    const client = interaction.client;
    const allSettings = client.getSettings();

    if (!allSettings[guildId]) allSettings[guildId] = {};
    if (!allSettings[guildId].bypassUsers) allSettings[guildId].bypassUsers = [];

    const bypassList = allSettings[guildId].bypassUsers;

    if (action === 'allow') {
      if (bypassList.includes(target.id)) {
        return interaction.reply({ content: `⚠️ <@${target.id}> はすでに裏アカウント許可リストに登録されています。`, ephemeral: true });
      }
      
      bypassList.push(target.id);
      await client.saveSettings(allSettings);

      const embed = new EmbedBuilder()
        .setTitle('✅ 裏アカウント例外許可')
        .setDescription(`<@${target.id}> を裏アカウント制限の対象外（許可）に設定しました。\n今後、このユーザーは同一IPチェックで弾かれなくなります。`)
        .setColor(0x2ecc71)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });

    } else if (action === 'remove') {
      const index = bypassList.indexOf(target.id);
      if (index === -1) {
        return interaction.reply({ content: `⚠️ <@${target.id}> は裏アカウント許可リストに登録されていません。`, ephemeral: true });
      }

      bypassList.splice(index, 1);
      await client.saveSettings(allSettings);

      const embed = new EmbedBuilder()
        .setTitle('🗑️ 裏アカウント許可解除')
        .setDescription(`<@${target.id}> の例外許可を削除しました。\n次回以降の認証では、通常通り裏垢チェック（重複IPチェック）が適用されます。`)
        .setColor(0xe74c3c)
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }
  }
};
