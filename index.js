const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

client.commands = new Collection();
const configPath = path.join(__dirname, 'config.json');

function getConfig(guildId) {
  if (!fs.existsSync(configPath)) return {};
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return config[guildId] || {};
}

// コマンド個別読み込み
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
const commandsArray = [];

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commandsArray.push(command.data.toJSON());
}

client.once('ready', async () => {
  console.log(`Bot logged in as ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('スラッシュコマンドをDiscord APIに登録中...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commandsArray }
    );
    console.log('スラッシュコマンドの登録が完了しました。');
  } catch (error) {
    console.error('コマンド登録エラー:', error);
  }
});

client.on('interactionCreate', async (interaction) => {
  // スラッシュコマンド実行ハンドラ
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: 'コマンド実行時にエラーが発生しました。', ephemeral: true });
    }
  }

  // ボタン押下（パネル操作）ハンドラ
  if (interaction.isButton()) {
    if (interaction.customId === 'remove_roles_button') {
      // ボタン操作もサーバー所有者限定にする場合
      if (interaction.guild.ownerId !== interaction.user.id) {
        return interaction.reply({ content: '❌ この操作はサーバー所有者限定です。', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      const guildId = interaction.guildId;
      const guildConfig = getConfig(guildId);
      const roleIds = guildConfig.removeRoleIds || [];

      if (roleIds.length === 0) {
        return interaction.editReply({ content: '⚠️ このサーバーには削除対象のロールが設定されていません。先に `/setroles` で設定してください。' });
      }

      const member = interaction.member;
      const removedRoles = [];

      for (const roleId of roleIds) {
        if (member.roles.cache.has(roleId)) {
          try {
            await member.roles.remove(roleId);
            removedRoles.push(roleId);
          } catch (err) {
            console.error(`ロール(ID: ${roleId})の削除に失敗しました:`, err);
          }
        }
      }

      if (removedRoles.length > 0) {
        const removedMentions = removedRoles.map(id => `<@&${id}>`).join(', ');
        await interaction.editReply({ content: `✅ 以下のロールを削除しました: ${removedMentions}` });

        // ログ送信処理
        if (guildConfig.logChannelId) {
          const logChannel = interaction.guild.channels.cache.get(guildConfig.logChannelId);
          if (logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('ロール削除ログ')
              .setColor(0xff0000)
              .addFields(
                { name: '実行者', value: `${interaction.user.tag} (<@${interaction.user.id}>)` },
                { name: '削除されたロール', value: removedMentions }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] });
          }
        }
      } else {
        await interaction.editReply({ content: 'ℹ️ 削除対象となるロールを保持していません。' });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
