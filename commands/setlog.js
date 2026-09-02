const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlog')
    .setDescription('ログ出力先チャンネルを設定します（サーバー所有者限定）')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(opt => opt.setName('channel').setDescription('ログ用チャンネル').setRequired(true)),

  async execute(interaction) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ このコマンドはサーバー所有者のみ実行可能です。', ephemeral: true });
    }

    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;

    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (!config[guildId]) config[guildId] = {};
    config[guildId].logChannelId = channel.id;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    await interaction.reply({ content: `✅ ログチャンネルを <#${channel.id}> に設定しました。`, ephemeral: true });
  }
};
