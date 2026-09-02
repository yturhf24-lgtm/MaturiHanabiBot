const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder, Events, MessageFlags } = require('discord.js');

// --- Express サーバー ---
const app = express();
const port = process.env.PORT || 4000;
app.get('/', (req, res) => res.send('Bot Status: Online'));
app.listen(port, () => console.log(`Server listening on port ${port}`));

// --- GitHub 自動生成＆直接保存・同期 ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'yturhf24-lgtm';
const REPO = '-bot';
const BRANCH = 'main';
const FILE_PATH = 'config.json';

// メモリ上で管理する設定データ構造
let globalConfig = {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// GitHub から設定ファイルを直接読み込み（なければ初期テンプレートを自動作成）
async function syncConfigFromGithub() {
  if (!GITHUB_TOKEN) {
    console.warn('⚠️ GITHUB_TOKEN が設定されていません。メモリ上でのみ設定を保持します。');
    return;
  }
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'Node.js' }
    });

    if (res.ok) {
      const data = await res.json();
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      globalConfig = JSON.parse(content || '{}');
      console.log('✅ GitHub から最新の設定データを同期しました。');
    } else if (res.status === 404) {
      console.log('ℹ️ GitHub 上に config.json が見つかりません。新規作成します...');
      globalConfig = {};
      await saveConfigToGithub();
    }
  } catch (err) {
    console.error('GitHub 同期エラー:', err);
  }
}

// メモリ上の設定データを直接 GitHub にコミット＆保存
async function saveConfigToGithub() {
  if (!GITHUB_TOKEN) return;

  const content = JSON.stringify(globalConfig, null, 2);
  const base64Content = Buffer.from(content).toString('base64');
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;

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
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js'
      },
      body: JSON.stringify({
        message: 'Auto-updated config by Bot',
        content: base64Content,
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    });

    if (putRes.ok) {
      console.log('✅ GitHub への直接保存が完了しました。');
    } else {
      console.error('GitHub 保存失敗:', await putRes.text());
    }
  } catch (err) {
    console.error('GitHub 保存エラー:', err);
  }
}

// サーバーごとの設定を更新してGitHubへ直接同期
async function updateGuildConfig(guildId, key, value) {
  if (!globalConfig[guildId]) {
    globalConfig[guildId] = {
      enabled: false,
      conditionRoleId: null,
      removeRoleIds: [],
      addRoleIds: [],
      logChannelId: null
    };
  }

  globalConfig[guildId][key] = value;
  await saveConfigToGithub();
  return globalConfig;
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

const commandPath = require.resolve('./commands/panel.js');
const panelModule = require(commandPath);
client.commands.set(panelModule.data.name, panelModule);
const commandsArray = [panelModule.data.toJSON()];

// レート制限対策付き ロール操作ラッパー
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

// 1人のメンバーのロール変更処理＆個別ログ送信
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

// 単一サーバーのスキャン
async function scanSingleGuild(guild) {
  const guildConfig = globalConfig[guild.id];
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

// 全サーバーのスキャン
async function scanAllGuilds() {
  for (const guild of client.guilds.cache.values()) {
    await scanSingleGuild(guild);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  // Bot起動時に GitHub から設定を直接ダウンロード
  await syncConfigFromGithub();

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(c.user.id), { body: commandsArray });
  } catch (e) {}

  await scanAllGuilds();

  // 10秒ごとに自動監視
  setInterval(async () => {
    await scanAllGuilds();
  }, 10 * 1000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
    await syncConfigFromGithub();
    const cmd = client.commands.get('panel');
    if (cmd) await cmd.execute(interaction, globalConfig);
    return;
  }

  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isButton()) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ この操作はサーバー所有者しかできません。', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;

    if (interaction.customId === 'select_condition_role') {
      const updatedConfig = await updateGuildConfig(guildId, 'conditionRoleId', interaction.values[0]);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'select_remove_roles') {
      const updatedConfig = await updateGuildConfig(guildId, 'removeRoleIds', interaction.values);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'select_add_roles') {
      const updatedConfig = await updateGuildConfig(guildId, 'addRoleIds', interaction.values);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'select_log_channel') {
      const selectedChannel = interaction.values[0] || null;
      const updatedConfig = await updateGuildConfig(guildId, 'logChannelId', selectedChannel);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'toggle_active_button') {
      const currentConfig = globalConfig[guildId] || {};

      if (!currentConfig.enabled && !currentConfig.conditionRoleId) {
        return interaction.reply({ content: '⚠️ 「1. チェックするロール」を事前に設定してください。', flags: MessageFlags.Ephemeral });
      }

      const nextStatus = !currentConfig.enabled;
      const updatedConfig = await updateGuildConfig(guildId, 'enabled', nextStatus);

      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
