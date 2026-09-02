const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Express サーバー設定 ---
const app = express();
const port = process.env.PORT || 4000;
app.get('/', (req, res) => res.send('Bot Status: Online'));
app.listen(port, () => console.log(`Server listening on port ${port}`));

// --- GitHub トークンによる config.json 直接保存 ---
// 環境変数からのみ取得（セキュリティ自動失効対策）
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'yturhf24-lgtm';
const REPO = '-bot';
const BRANCH = 'main';

const configPath = path.join(__dirname, 'config.json');

async function saveConfigToGithub() {
  if (!GITHUB_TOKEN) {
    console.error('❌ GITHUB_TOKEN が設定されていません。Renderの環境変数を確認してください。');
    return;
  }
  if (!fs.existsSync(configPath)) return;

  const content = fs.readFileSync(configPath, 'utf8');
  const base64Content = Buffer.from(content).toString('base64');
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/config.json`;

  let sha = null;
  try {
    const res = await fetch(`${url}?ref=${BRANCH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Node.js'
      }
    });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch (e) {}

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js'
      },
      body: JSON.stringify({
        message: 'Update config.json directly via bot',
        content: base64Content,
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    });

    if (response.ok) {
      console.log('✅ GitHubへ config.json を直接保存しました。');
    } else {
      console.error('❌ GitHub保存失敗:', await response.json());
    }
  } catch (err) {
    console.error('❌ GitHub保存エラー:', err);
  }
}

// --- Discord Bot 設定 ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

client.commands = new Collection();

function loadConfig() {
  if (!fs.existsSync(configPath)) return {};
  try { return JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { return {}; }
}

function updateGuildConfig(guildId, key, value) {
  const config = loadConfig();
  if (!config[guildId]) config[guildId] = {};
  config[guildId][key] = value;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  saveConfigToGithub();
  return config;
}

// コマンド読み込み
const commandPath = path.join(__dirname, 'commands/panel.js');
const panelModule = require(commandPath);
client.commands.set(panelModule.data.name, panelModule);
const commandsArray = [panelModule.data.toJSON()];

// ロール処理およびログ送信関数
async function processMemberRoles(member, guildConfig, executionType = 'manual') {
  const { conditionRoleId, removeRoleIds = [], addRoleIds = [], logChannelId } = guildConfig;
  if (!conditionRoleId) return false;

  // 条件ロールを持っていない場合は処理スキップ
  if (!member.roles.cache.has(conditionRoleId)) return false;

  const rolesToRemove = removeRoleIds.filter(id => member.roles.cache.has(id));
  const rolesToAdd = addRoleIds.filter(id => !member.roles.cache.has(id));

  // 変更対象ロールがない場合は終了
  if (rolesToRemove.length === 0 && rolesToAdd.length === 0) return false;

  for (const id of rolesToRemove) {
    try { await member.roles.remove(id); } catch (e) { console.error(`Role remove error (${id}):`, e); }
  }

  for (const id of rolesToAdd) {
    try { await member.roles.add(id); } catch (e) { console.error(`Role add error (${id}):`, e); }
  }

  // 設定されたログチャンネルへ送信
  if (logChannelId) {
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      let titleText = '⚙️ パネル手動実行';
      if (executionType === 'auto') titleText = '🔄 5分定期監視ロール自動更新';
      if (executionType === 'startup') titleText = '🔄 オンライン復帰時ロール自動更新';

      const removedText = rolesToRemove.length > 0 ? rolesToRemove.map(id => `<@&${id}>`).join(', ') : 'なし';
      const addedText = rolesToAdd.length > 0 ? rolesToAdd.map(id => `<@&${id}>`).join(', ') : 'なし';

      const embed = new EmbedBuilder()
        .setTitle(titleText)
        .setColor(0x00ff00)
        .addFields(
          { name: '対象ユーザー', value: `${member.user.tag} (<@${member.id}>)` },
          { name: '条件判定ロール', value: `<@&${conditionRoleId}>` },
          { name: '削除されたロール', value: removedText },
          { name: '追加されたロール', value: addedText }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  return true;
}

// 全サーバー監視スキャン関数
async function scanAllGuilds(executionType) {
  const allConfigs = loadConfig();

  for (const guild of client.guilds.cache.values()) {
    const guildConfig = allConfigs[guild.id];
    if (!guildConfig || !guildConfig.conditionRoleId) continue;

    try {
      const members = await guild.members.fetch();
      for (const member of members.values()) {
        if (!member.user.bot) {
          await processMemberRoles(member, guildConfig, executionType);
        }
      }
    } catch (err) {
      console.error(`Guild fetch error (${guild.id}):`, err);
    }
  }
}

// Ready イベント
client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(c.user.id), { body: commandsArray });
    console.log('/panel コマンドの登録成功');
  } catch (e) {
    console.error('コマンド登録エラー:', e);
  }

  // 1. オフラインからオンライン復帰時の確認
  console.log('オンライン復帰時の確認スキャンを開始...');
  await scanAllGuilds('startup');
  console.log('オンライン復帰時スキャン完了');

  // 2. 5分ごとの最新状態定時監視タスク (300,000 ms)
  setInterval(async () => {
    console.log('⏰ [5分定期監視] ロール状態の最新更新スキャンを実行中...');
    await scanAllGuilds('auto');
  }, 5 * 60 * 1000);
});

// インタラクション受信（パネル操作・ドロップダウン・ボタン対応）
client.on(Events.InteractionCreate, async (interaction) => {
  // /panel コマンド実行
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
    const cmd = client.commands.get('panel');
    if (cmd) await cmd.execute(interaction);
    return;
  }

  // 以降のパネル操作（メニュー・ボタン）はすべてサーバー所有者限定
  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isButton()) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ この操作はサーバー所有者限定です。', ephemeral: true });
    }

    const guildId = interaction.guildId;

    // 1. 条件ロール選択
    if (interaction.customId === 'select_condition_role') {
      const selectedRoleId = interaction.values[0];
      const updatedConfig = updateGuildConfig(guildId, 'conditionRoleId', selectedRoleId);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed] });
    }

    // 2. 削除対象ロール選択
    if (interaction.customId === 'select_remove_roles') {
      const selectedRoleIds = interaction.values;
      const updatedConfig = updateGuildConfig(guildId, 'removeRoleIds', selectedRoleIds);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed] });
    }

    // 3. 追加対象ロール選択
    if (interaction.customId === 'select_add_roles') {
      const selectedRoleIds = interaction.values;
      const updatedConfig = updateGuildConfig(guildId, 'addRoleIds', selectedRoleIds);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed] });
    }

    // 4. Log返信チャンネル選択
    if (interaction.customId === 'select_log_channel') {
      const selectedChannelId = interaction.values[0] || null;
      const updatedConfig = updateGuildConfig(guildId, 'logChannelId', selectedChannelId);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed] });
    }

    // 5. 手動実行ボタン
    if (interaction.customId === 'process_roles_button') {
      await interaction.deferReply({ ephemeral: true });

      const allConfigs = loadConfig();
      const guildConfig = allConfigs[guildId];

      if (!guildConfig || !guildConfig.conditionRoleId) {
        return interaction.editReply({ content: '⚠️ 条件ロールが未設定です。パネルのメニューから選択してください。' });
      }

      const updated = await processMemberRoles(interaction.member, guildConfig, 'manual');

      if (updated) {
        await interaction.editReply({ content: '✅ ロール更新処理が完了しました。' });
      } else {
        await interaction.editReply({ content: 'ℹ️ 条件ロールを保有していないか、変更対象のロールがありませんでした。' });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
