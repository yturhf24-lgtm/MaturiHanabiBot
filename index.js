const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Express サーバー ---
const app = express();
const port = process.env.PORT || 4000;
app.get('/', (req, res) => res.send('Bot Status: Online'));
app.listen(port, () => console.log(`Server listening on port ${port}`));

// --- GitHub 自動保存 ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'yturhf24-lgtm';
const REPO = '-bot';
const BRANCH = 'main';

const configPath = path.join(__dirname, 'config.json');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function saveConfigToGithub() {
  if (!GITHUB_TOKEN) return;
  if (!fs.existsSync(configPath)) return;

  const content = fs.readFileSync(configPath, 'utf8');
  const base64Content = Buffer.from(content).toString('base64');
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/config.json`;

  let sha = null;
  try {
    const res = await fetch(`${url}?ref=${BRANCH}`, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'Node.js' }
    });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch (e) {}

  try {
    await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js'
      },
      body: JSON.stringify({
        message: 'Update config.json',
        content: base64Content,
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    });
  } catch (err) {}
}

// --- Discord Bot ---
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

const commandPath = path.join(__dirname, 'commands/panel.js');
const panelModule = require(commandPath);
client.commands.set(panelModule.data.name, panelModule);
const commandsArray = [panelModule.data.toJSON()];

async function safeRoleAction(actionFn) {
  try {
    await actionFn();
  } catch (error) {
    if (error.code === 429 || error.status === 429) {
      const retryAfter = (error.retryAfter || 1000) + 100;
      console.warn(`⚠️ レート制限を検知。 ${retryAfter}ms 待機して再試行します...`);
      await sleep(retryAfter);
      try {
        await actionFn();
      } catch (retryErr) {
        console.error('リトライ失敗:', retryErr);
      }
    } else {
      console.error('ロール操作エラー:', error);
    }
  }
}

async function processMemberRoles(member, guildConfig) {
  const { conditionRoleId, removeRoleIds = [], addRoleIds = [], logChannelId } = guildConfig;
  if (!conditionRoleId) return false;

  if (!member.roles.cache.has(conditionRoleId)) return false;

  const rolesToRemove = removeRoleIds.filter(id => member.roles.cache.has(id));
  const rolesToAdd = addRoleIds.filter(id => !member.roles.cache.has(id));

  if (rolesToRemove.length === 0 && rolesToAdd.length === 0) return false;

  for (const id of rolesToRemove) {
    await safeRoleAction(() => member.roles.remove(id));
    await sleep(100);
  }

  for (const id of rolesToAdd) {
    await safeRoleAction(() => member.roles.add(id));
    await sleep(100);
  }

  if (logChannelId) {
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      const removedText = rolesToRemove.length > 0 ? rolesToRemove.map(id => `<@&${id}>`).join(', ') : 'なし';
      const addedText = rolesToAdd.length > 0 ? rolesToAdd.map(id => `<@&${id}>`).join(', ') : 'なし';

      const embed = new EmbedBuilder()
        .setTitle('🔄 自動ロール更新ログ')
        .setColor(0x00ff00)
        .addFields(
          { name: '👤 プレイヤー名', value: `${member.user.tag} (<@${member.id}>)` },
          { name: '🗑️ 削除ロール', value: removedText },
          { name: '➕ 付与ロール', value: addedText }
        )
        .setTimestamp();

      await safeRoleAction(() => logChannel.send({ embeds: [embed] }));
    }
  }

  return true;
}

// サーバー指定の一括スキャン（有効化されている場合のみ実行）
async function scanSingleGuild(guild) {
  const allConfigs = loadConfig();
  const guildConfig = allConfigs[guild.id];
  
  // 停止中の場合、または条件ロール未設定の場合はスキップ
  if (!guildConfig || !guildConfig.enabled || !guildConfig.conditionRoleId) return 0;

  let updatedCount = 0;
  try {
    const members = await guild.members.fetch();
    for (const member of members.values()) {
      if (!member.user.bot) {
        const updated = await processMemberRoles(member, guildConfig);
        if (updated) {
          updatedCount++;
          await sleep(200);
        }
      }
    }
  } catch (err) {
    console.error(`Guild fetch error (${guild.id}):`, err);
  }

  return updatedCount;
}

// 全サーバー自動スキャン
async function scanAllGuilds() {
  for (const guild of client.guilds.cache.values()) {
    await scanSingleGuild(guild);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(c.user.id), { body: commandsArray });
  } catch (e) {}

  await scanAllGuilds();

  // 10秒毎に自動チェック
  setInterval(async () => {
    await scanAllGuilds();
  }, 10 * 1000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
    const cmd = client.commands.get('panel');
    if (cmd) await cmd.execute(interaction);
    return;
  }

  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isButton()) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ この操作はサーバー所有者しかできません。', ephemeral: true });
    }

    const guildId = interaction.guildId;

    if (interaction.customId === 'select_condition_role') {
      const updatedConfig = updateGuildConfig(guildId, 'conditionRoleId', interaction.values[0]);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'select_remove_roles') {
      const updatedConfig = updateGuildConfig(guildId, 'removeRoleIds', interaction.values);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'select_add_roles') {
      const updatedConfig = updateGuildConfig(guildId, 'addRoleIds', interaction.values);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'select_log_channel') {
      const selectedChannel = interaction.values[0] || null;
      const updatedConfig = updateGuildConfig(guildId, 'logChannelId', selectedChannel);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    // 開始/停止 ボタンの処理
    if (interaction.customId === 'toggle_active_button') {
      const currentConfig = loadConfig()[guildId] || {};
      
      // 条件ロール未設定で開始しようとした場合はブロック
      if (!currentConfig.enabled && !currentConfig.conditionRoleId) {
        return interaction.reply({ content: '⚠️ 「1. チェックするロール」を事前に設定してください。', ephemeral: true });
      }

      const nextStatus = !currentConfig.enabled;
      const updatedConfig = updateGuildConfig(guildId, 'enabled', nextStatus);

      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
