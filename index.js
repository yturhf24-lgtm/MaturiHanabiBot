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

// 1人のメンバーのロール変更処理
async function processMemberRoles(member, guildConfig) {
  const { conditionRoleId, removeRoleIds = [], addRoleIds = [] } = guildConfig;
  if (!conditionRoleId) return null;

  // 条件ロールを持っていない場合は対象外
  if (!member.roles.cache.has(conditionRoleId)) return null;

  const rolesToRemove = removeRoleIds.filter(id => member.roles.cache.has(id));
  const rolesToAdd = addRoleIds.filter(id => !member.roles.cache.has(id));

  // 変更の必要がない場合
  if (rolesToRemove.length === 0 && rolesToAdd.length === 0) return null;

  // 実際の付け外し処理
  for (const id of rolesToRemove) {
    try { await member.roles.remove(id); } catch (e) {}
  }

  for (const id of rolesToAdd) {
    try { await member.roles.add(id); } catch (e) {}
  }

  // ログ記載用のデータを返す
  return {
    member: member,
    removedRoles: rolesToRemove,
    addedRoles: rolesToAdd
  };
}

// サーバー指定の一括スキャン（プレイヤー単位で結果をまとめて通知）
async function scanSingleGuild(guild, executionType) {
  const allConfigs = loadConfig();
  const guildConfig = allConfigs[guild.id];
  if (!guildConfig || !guildConfig.conditionRoleId) return 0;

  const results = [];
  try {
    const members = await guild.members.fetch();
    for (const member of members.values()) {
      if (!member.user.bot) {
        const res = await processMemberRoles(member, guildConfig);
        if (res) results.push(res);
      }
    }
  } catch (err) {
    console.error(`Guild fetch error (${guild.id}):`, err);
  }

  // 変更のあったプレイヤーがいる場合のみ、まとめログを送信
  if (results.length > 0 && guildConfig.logChannelId) {
    const logChannel = guild.channels.cache.get(guildConfig.logChannelId);
    if (logChannel) {
      let titleText = '⚙️ パネルからの手動一括実行';
      if (executionType === 'auto') titleText = '🔄 5分定期チェックによる自動更新';
      if (executionType === 'startup') titleText = '🔄 Bot起動時の自動更新';

      const embed = new EmbedBuilder()
        .setTitle(titleText)
        .setColor(0x00ff00)
        .setDescription(`**更新人数:** ${results.length}名`)
        .setTimestamp();

      // 各プレイヤー単位でフィールドを追加
      // Discord Embedのフィールド上限(25件)に対応するため最大20名まで表示
      for (const res of results.slice(0, 20)) {
        const removedText = res.removedRoles.length > 0 ? res.removedRoles.map(id => `<@&${id}>`).join(', ') : 'なし';
        const addedText = res.addedRoles.length > 0 ? res.addedRoles.map(id => `<@&${id}>`).join(', ') : 'なし';

        embed.addFields({
          name: `👤 ${res.member.user.tag} (${res.member.displayName})`,
          value: `**削除ロール:** ${removedText}\n**付与ロール:** ${addedText}`,
          inline: false
        });
      }

      if (results.length > 20) {
        embed.setFooter({ text: `※他 ${results.length - 20} 名の処理結果は省略されました` });
      }

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  return results.length;
}

// 全サーバー自動スキャン（定期監視用）
async function scanAllGuilds(executionType) {
  for (const guild of client.guilds.cache.values()) {
    await scanSingleGuild(guild, executionType);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(c.user.id), { body: commandsArray });
  } catch (e) {}

  await scanAllGuilds('startup');

  setInterval(async () => {
    await scanAllGuilds('auto');
  }, 5 * 60 * 1000);
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
      return interaction.update({ embeds: [embed] });
    }

    if (interaction.customId === 'select_remove_roles') {
      const updatedConfig = updateGuildConfig(guildId, 'removeRoleIds', interaction.values);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed] });
    }

    if (interaction.customId === 'select_add_roles') {
      const updatedConfig = updateGuildConfig(guildId, 'addRoleIds', interaction.values);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed] });
    }

    if (interaction.customId === 'select_log_channel') {
      const updatedConfig = updateGuildConfig(guildId, 'logChannelId', interaction.values[0] || null);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed] });
    }

    // 全メンバー一括実行ボタンの処理
    if (interaction.customId === 'process_roles_button') {
      await interaction.deferReply({ ephemeral: true });

      const allConfigs = loadConfig();
      const guildConfig = allConfigs[guildId];

      if (!guildConfig || !guildConfig.conditionRoleId) {
        return interaction.editReply({ content: '⚠️ 「1. チェックするロール」が選ばれていません。メニューから選んでください！' });
      }

      const count = await scanSingleGuild(interaction.guild, 'manual');

      if (count > 0) {
        await interaction.editReply({ content: `✅ スキャン完了！\n**${count}名**のロールを更新し、ログチャンネルへ結果を送信しました。` });
      } else {
        await interaction.editReply({ content: 'ℹ️ 全メンバーをチェックしましたが、ロールを変更したプレイヤーはいませんでした。' });
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
