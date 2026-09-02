const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

client.commands = new Collection();
const configPath = path.join(__dirname, 'config.json');

function loadConfig() {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    return {};
  }
}

// 個別コマンドの読み込み
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
const commandsArray = [];

for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.data.name, command);
  commandsArray.push(command.data.toJSON());
}

// メンバーに対するロール処理関数
async function processMemberRoles(member, guildConfig, isAutoCheck = false) {
  const { conditionRoleId, removeRoleIds = [], addRoleIds = [], logChannelId } = guildConfig;
  if (!conditionRoleId) return false;

  // 条件ロールを所有しているか判定
  if (!member.roles.cache.has(conditionRoleId)) return false;

  const rolesToRemove = removeRoleIds.filter(id => member.roles.cache.has(id));
  const rolesToAdd = addRoleIds.filter(id => !member.roles.cache.has(id));

  if (rolesToRemove.length === 0 && rolesToAdd.length === 0) return false;

  // 削除処理
  for (const id of rolesToRemove) {
    try { await member.roles.remove(id); } catch (e) { console.error(`Role remove error: ${id}`, e); }
  }

  // 追加処理
  for (const id of rolesToAdd) {
    try { await member.roles.add(id); } catch (e) { console.error(`Role add error: ${id}`, e); }
  }

  // ログ送信処理
  if (logChannelId) {
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      const removedText = rolesToRemove.length > 0 ? rolesToRemove.map(id => `<@&${id}>`).join(', ') : 'なし';
      const addedText = rolesToAdd.length > 0 ? rolesToAdd.map(id => `<@&${id}>`).join(', ') : 'なし';

      const embed = new EmbedBuilder()
        .setTitle(isAutoCheck ? '🔄 オンライン復帰時自動チェックログ' : '⚙️ パネル操作実行ログ')
        .setColor(0x2ecc71)
        .addFields(
          { name: '対象ユーザー', value: `${member.user.tag} (<@${member.id}>)` },
          { name: '条件ロール', value: `<@&${conditionRoleId}>` },
          { name: '削除されたロール', value: removedText },
          { name: '追加されたロール', value: addedText }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  return true;
}

// オンライン復帰時の自動ロール確認
client.once('ready', async () => {
  console.log(`Bot Online: ${client.user.tag}`);

  // スラッシュコマンド登録
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(client.user.id), { body: commandsArray });
    console.log('スラッシュコマンド更新完了');
  } catch (e) {
    console.error('コマンド登録エラー:', e);
  }

  // 全ギルド・全メンバーをチェックしてオフライン中の変動を確認
  console.log('オンライン復帰時のメンバーロール確認を開始...');
  const allConfigs = loadConfig();

  for (const guild of client.guilds.cache.values()) {
    const guildConfig = allConfigs[guild.id];
    if (!guildConfig || !guildConfig.conditionRoleId) continue;

    try {
      const members = await guild.members.fetch();
      for (const member of members.values()) {
        if (!member.user.bot) {
          await processMemberRoles(member, guildConfig, true);
        }
      }
    } catch (err) {
      console.error(`Guild fetch error for ${guild.id}:`, err);
    }
  }
  console.log('オンライン復帰時ロールチェック完了');
});

// インタラクション処理
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction);
  }

  if (interaction.isButton() && interaction.customId === 'process_roles_button') {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ この操作はサーバー所有者限定です。', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const allConfigs = loadConfig();
    const guildConfig = allConfigs[interaction.guildId];

    if (!guildConfig || !guildConfig.conditionRoleId) {
      return interaction.editReply({ content: '⚠️ このサーバーの設定が済んでいません。先に `/config` を実行してください。' });
    }

    const updated = await processMemberRoles(interaction.member, guildConfig, false);

    if (updated) {
      await interaction.editReply({ content: '✅ ロールの更新処理が正常に完了しました。' });
    } else {
      await interaction.editReply({ content: 'ℹ️ 条件ロールを保持していないか、更新・変更対象のロールがありませんでした。' });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
