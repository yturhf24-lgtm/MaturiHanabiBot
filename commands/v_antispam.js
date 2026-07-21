const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('v_antispam')
    .setDescription('連投スパムに対する自動Kick/Ban機能を設定します。')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt => 
      opt.setName('status')
        .setDescription('有効/無効の切り替え')
        .setRequired(true)
        .addChoices({ name: 'ON (有効)', value: 'on' }, { name: 'OFF (無効)', value: 'off' })
    )
    .addIntegerOption(opt => opt.setName('seconds').setDescription('判定する秒数').setMinValue(1).setMaxValue(60))
    .addIntegerOption(opt => opt.setName('messages').setDescription('何回投稿されたら処罰するか').setMinValue(2).setMaxValue(50))
    .addStringOption(opt => 
      opt.setName('action')
        .setDescription('処罰内容')
        .addChoices({ name: 'Kick', value: 'kick' }, { name: 'Ban', value: 'ban' })
    ),

  async execute(interaction) {
    const status = interaction.options.getString('status');
    const guildId = interaction.guildId;
    const client = interaction.client;
    const allSettings = client.getSettings();

    if (!allSettings[guildId]) allSettings[guildId] = {};

    if (status === 'off') {
      allSettings[guildId].antiSpam = { enabled: false };
      await client.saveSettings(allSettings);
      return interaction.reply({ content: '⚙️ スパム保護機能を **OFF** に設定しました。', ephemeral: true });
    }

    const seconds = interaction.options.getInteger('seconds') || 5;
    const messages = interaction.options.getInteger('messages') || 5;
    const action = interaction.options.getString('action') || 'kick';

    allSettings[guildId].antiSpam = { enabled: true, seconds, maxMessages: messages, action };
    await client.saveSettings(allSettings);

    return interaction.reply({ content: `⚙️ スパム保護を設定しました:\n・**条件:** ${seconds}秒間に ${messages}メッセージ\n・**処罰:** ${action.toUpperCase()}`, ephemeral: true });
  }
};
