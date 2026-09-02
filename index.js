const { 
  Client, 
  GatewayIntentBits, 
  SlashCommandBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  EmbedBuilder, 
  PermissionFlagsBits 
} = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

// メモリ上にログチャンネルと削除対象ロールの設定を保存（実運用では永続化を行なってください）
const guildSettings = new Map();

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // /コマンド定義（個別化）
  const commands = [
    new SlashCommandBuilder()
      .setName('setlog')
      .setDescription('ログ出力先チャンネルを設定します【サーバー所有者専用】')
      .addChannelOption(option => 
        option.setName('channel').setDescription('ログ用チャンネル').setRequired(true)),

    new SlashCommandBuilder()
      .setName('setroles')
      .setDescription('削除対象にする複数ロールを設定します【サーバー所有者専用】')
      .addRoleOption(option => option.setName('role1').setDescription('ロール 1').setRequired(true))
      .addRoleOption(option => option.setName('role2').setDescription('ロール 2'))
      .addRoleOption(option => option.setName('role3').setDescription('ロール 3')),

    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('ロール削除パネルを生成します【サーバー所有者専用】')
      .addStringOption(option => option.setName('title').setDescription('パネルのタイトル'))
  ];

  await client.application.commands.set(commands);
});

// コマンド処理
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    // 【所有者限定】セキュリティ判定
    if (interaction.user.id !== interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ このコマンドはサーバー所有者のみが実行できます。', flags: 64 });
    }

    const { commandName, guildId } = interaction;
    let settings = guildSettings.get(guildId) || { roles: [], logChannelId: null };

    // 1. /setlog : ログチャンネル設定
    if (commandName === 'setlog') {
      const channel = interaction.options.getChannel('channel');
      settings.logChannelId = channel.id;
      guildSettings.set(guildId, settings);
      return interaction.reply({ content: `✅ ログチャンネルを ${channel} に設定しました。`, flags: 64 });
    }

    // 2. /setroles : 削除対象ロール設定
    if (commandName === 'setroles') {
      const roles = [];
      for (let i = 1; i <= 3; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) roles.push(role.id);
      }
      settings.roles = roles;
      guildSettings.set(guildId, settings);
      return interaction.reply({ 
        content: `✅ 削除対象ロールを設定しました: ${roles.map(r => `<@&${r}>`).join(', ')}`, 
        flags: 64 
      });
    }

    // 3. /panel : パネル生成
    if (commandName === 'panel') {
      const title = interaction.options.getString('title') || 'ロール解除パネル';
      
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription('下のボタンを押すと、設定されたロールを自身から削除します。')
        .setColor(0xff0000);

      const button = new ButtonBuilder()
        .setCustomId('remove_roles_btn')
        .setLabel('ロールを解除する')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(button);

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ パネルを生成しました。', flags: 64 });
    }
  }

  // ボタン処理
  if (interaction.isButton() && interaction.customId === 'remove_roles_btn') {
    const settings = guildSettings.get(interaction.guildId);

    if (!settings || !settings.roles || settings.roles.length === 0) {
      return interaction.reply({ content: '⚠️ 削除対象のロールがまだ設定されていません。', flags: 64 });
    }

    const member = interaction.member;
    const removedRoles = [];

    for (const roleId of settings.roles) {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch(() => {});
        removedRoles.push(roleId);
      }
    }

    if (removedRoles.length === 0) {
      return interaction.reply({ content: '該当するロールを所持していません。', flags: 64 });
    }

    await interaction.reply({ content: '✅ 対象のロールを削除しました。', flags: 64 });

    // ログチャンネルへ送信
    if (settings.logChannelId) {
      const logChannel = interaction.guild.channels.cache.get(settings.logChannelId);
      if (logChannel) {
        const logEmbed = new EmbedBuilder()
          .setTitle('ロール削除ログ')
          .setColor(0x00ff00)
          .addFields(
            { name: '実行ユーザー', value: `${interaction.user.tag} (${interaction.user.id})` },
            { name: '削除されたロール', value: removedRoles.map(r => `<@&${r}>`).join(', ') }
          )
          .setTimestamp();

        logChannel.send({ embeds: [logEmbed] });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
