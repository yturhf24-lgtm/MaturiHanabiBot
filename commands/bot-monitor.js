const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot-monitor')
    .setDescription('他Botのオンライン・オフライン状態を監視・通知するかどうかを設定します')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption(option =>
      option.setName('status')
        .setDescription('通知をONにするかOFFにするかを選択してください')
        .setRequired(true)
        .addChoices(
          { name: 'ON', value: 'on' },
          { name: 'OFF', value: 'off' }
        )
    )
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('通知を送信するチャンネル（ONにする場合は必須です）')
        .setRequired(false)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('メンションするロール（任意）')
        .setRequired(false)
    ),

  async execute(interaction, client) {
    // 実際の処理は index.js 側の interactionCreate で一括処理されます
  },
};
