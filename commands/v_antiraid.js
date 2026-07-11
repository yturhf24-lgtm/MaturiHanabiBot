const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_antiraid')
    .setDescription('【管理者専用】新規・捨てアカウントの自動Kick機能を設定します')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    // サブコマンド1: 初期アイコンキックのON/OFF
    .addSubcommand(subcmd =>
      subcmd
        .setName('default_avatar')
        .setDescription('初期アイコンのユーザーを自動Kickするか設定します')
        .addStringOption(opt =>
          opt.setName('status')
            .setDescription('有効(on) / 無効(off)')
            .setRequired(true)
            .addChoices(
              { name: '有効化 (ON)', value: 'on' },
              { name: '無効化 (OFF)', value: 'off' }
            )
        )
    )
    // サブコマンド2: アカウント作成日数の制限設定
    .addSubcommand(subcmd =>
      subcmd
        .setName('account_age')
        .setDescription('指定日数未満の新規アカウントを自動Kickします（0で無効）')
        .addIntegerOption(opt => 
          opt.setName('days')
            .setDescription('制限する日数（例: 7日未満をKickしたい場合は「7」を入力）')
            .setRequired(true)
            .setMinValue(0)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const allSettings = interaction.client.getSettings();

    // サーバー個別枠の初期化
    if (!allSettings[guildId]) allSettings[guildId] = {};
    if (!allSettings[guildId].antiRaid) {
      allSettings[guildId].antiRaid = {
        kickDefaultAvatar: false,
        kickAccountAgeDays: 0
      };
    }

    const config = allSettings[guildId].antiRaid;

    // 👤 初期アイコンキックの設定変更
    if (sub === 'default_avatar') {
      const status = interaction.options.getString('status');
      config.kickDefaultAvatar = (status === 'on');
      
      await interaction.client.saveSettings(allSettings);
      
      return interaction.reply({
        content: `⚙️ 初期アイコンの自動Kick機能を **${status === 'on' ? '🟢 有効 (ON)' : '🔴 無効 (OFF)'}** に設定しました。`,
        flags: [MessageFlags.Ephemeral]
      });
    }

    // 📅 作成日数の設定変更
    if (sub === 'account_age') {
      const days = interaction.options.getInteger('days');
      config.kickAccountAgeDays = days;
      
      await interaction.client.saveSettings(allSettings);
      
      if (days === 0) {
        return interaction.reply({
          content: `⚙️ アカウント作成日数による自動Kick機能を **🔴 無効化** しました。`,
          flags: [MessageFlags.Ephemeral]
        });
      } else {
        return interaction.reply({
          content: `⚙️ 作成されてから **${days}日未満** の新規アカウントを自動Kickするように設定しました。`,
          flags: [MessageFlags.Ephemeral]
        });
      }
    }
  }
};
