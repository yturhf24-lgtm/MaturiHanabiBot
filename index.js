const express = require('express');
const { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  Collection, 
  EmbedBuilder, 
  Events, 
  MessageFlags, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');

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

let globalConfig = {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function syncConfigFromGithub() {
  if (!GITHUB_TOKEN) return;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${BRANCH}`;

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN.trim()}`,
        'User-Agent': 'Node.js',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const content = Buffer.from(data.content, 'base64').toString('utf8');
      globalConfig = JSON.parse(content || '{}');
      console.log('✅ GitHub から最新の設定データを同期しました。');
    } else if (res.status === 404) {
      globalConfig = {};
      await saveConfigToGithub();
    }
  } catch (err) {
    console.error('GitHub 同期エラー:', err);
  }
}

async function saveConfigToGithub() {
  if (!GITHUB_TOKEN) return;

  const content = JSON.stringify(globalConfig, null, 2);
  const base64Content = Buffer.from(content).toString('base64');
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`;

  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN.trim()}`,
    'User-Agent': 'Node.js',
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  let sha = null;
  try {
    const res = await fetch(`${url}?ref=${BRANCH}`, { headers });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch (e) {}

  try {
    await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: 'Auto-updated config by Bot',
        content: base64Content,
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    });
  } catch (err) {
    console.error('GitHub 保存エラー:', err);
  }
}

// 共通設定初期化
function initGuildConfig(guildId) {
  if (!globalConfig[guildId]) {
    globalConfig[guildId] = {
      enabled: false,
      restartNotify: false,
      restartNotifyChannelId: null,
      conditionRoleId: null,
      removeRoleIds: [],
      addRoleIds: [],
      logChannelId: null,
      countConfig: {
        enabled: false,
        channelId: null,
        currentNum: 0,
        deleteWrong: true,
        warnEmbed: true
      },
      addRoleConfig: {
        enabled: false,
        checkRoleIds: [],
        addRoleIds: [],
        logChannelId: null
      }
    };
  }
  if (!globalConfig[guildId].addRoleConfig) {
    globalConfig[guildId].addRoleConfig = { enabled: false, checkRoleIds: [], addRoleIds: [], logChannelId: null };
  }
}

async function updateGuildConfig(guildId, key, value) {
  initGuildConfig(guildId);
  globalConfig[guildId][key] = value;
  await saveConfigToGithub();
  return globalConfig;
}

async function updateCountConfig(guildId, key, value) {
  initGuildConfig(guildId);
  globalConfig[guildId].countConfig[key] = value;
  await saveConfigToGithub();
  return globalConfig;
}

async function updateAddRoleConfig(guildId, key, value) {
  initGuildConfig(guildId);
  globalConfig[guildId].addRoleConfig[key] = value;
  await saveConfigToGithub();
  return globalConfig;
}

// --- Client 初期化 ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.commands = new Collection();

const panelModule = require('./commands/panel.js');
const countPanelModule = require('./commands/countPanel.js');
const roleAddPanelModule = require('./commands/roleAddPanel.js');

client.commands.set(panelModule.data.name, panelModule);
client.commands.set(countPanelModule.data.name, countPanelModule);
client.commands.set(roleAddPanelModule.data.name, roleAddPanelModule);

const commandsArray = [
  panelModule.data.toJSON(),
  countPanelModule.data.toJSON(),
  roleAddPanelModule.data.toJSON()
];

const processingMembers = new Set();

// --- 既存のロール制御処理 ---
async function processMemberRoles(member, guildConfig) {
  const { conditionRoleId, removeRoleIds = [], addRoleIds = [], logChannelId } = guildConfig;
  if (!conditionRoleId) return false;
  if (processingMembers.has(member.id)) return false;
  if (!member.roles.cache.has(conditionRoleId)) return false;

  const rolesToRemove = removeRoleIds.filter(id => member.roles.cache.has(id));
  const rolesToAdd = addRoleIds.filter(id => !member.roles.cache.has(id));

  if (rolesToRemove.length === 0 && rolesToAdd.length === 0) return false;

  processingMembers.add(member.id);

  try {
    if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove).catch(() => {});
    if (rolesToAdd.length > 0) await member.roles.add(rolesToAdd).catch(() => {});

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

        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }
    return true;
  } finally {
    setTimeout(() => processingMembers.delete(member.id), 1000);
  }
}

// --- 非所持者への自動ロール付与処理 ---
async function processAddRolesOnly(member, addRoleConfig) {
  if (!addRoleConfig || !addRoleConfig.enabled) return false;

  const { checkRoleIds = [], addRoleIds = [], logChannelId } = addRoleConfig;
  if (addRoleIds.length === 0) return false;

  const hasAnyCheckRole = checkRoleIds.some(id => member.roles.cache.has(id));
  if (hasAnyCheckRole) return false;

  const rolesToAdd = addRoleIds.filter(id => !member.roles.cache.has(id));
  if (rolesToAdd.length === 0) return false;

  try {
    await member.roles.add(rolesToAdd).catch(() => {});

    if (logChannelId) {
      const logChannel = member.guild.channels.cache.get(logChannelId);
      if (logChannel) {
        const addedText = rolesToAdd.map(id => `<@&${id}>`).join(', ');

        const embed = new EmbedBuilder()
          .setTitle('➕ 条件ロール付与ログ')
          .setColor(0x00ff00)
          .addFields(
            { name: '👤 対象メンバー', value: `${member.user.tag} (<@${member.id}>)` },
            { name: '➕ 付与されたロール', value: addedText }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [embed] }).catch(() => {});
      }
    }
    return true;
  } catch (err) {
    return false;
  }
}

async function scanSingleGuild(guild) {
  const guildConfig = globalConfig[guild.id];
  if (!guildConfig) return 0;

  let updatedCount = 0;
  const members = guild.members.cache;

  for (const member of members.values()) {
    if (!member.user.bot) {
      if (guildConfig.enabled) {
        if (await processMemberRoles(member, guildConfig)) updatedCount++;
      }
      if (guildConfig.addRoleConfig?.enabled) {
        if (await processAddRolesOnly(member, guildConfig.addRoleConfig)) updatedCount++;
      }
      await sleep(100);
    }
  }

  return updatedCount;
}

async function scanAllGuilds() {
  for (const guild of client.guilds.cache.values()) {
    await scanSingleGuild(guild);
  }
}

// --- イベント制御 ---
client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);
  await syncConfigFromGithub();

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(c.user.id), { body: commandsArray });
    console.log('✅ スラッシュコマンドを正常に登録しました。');
  } catch (e) {
    console.error('スラッシュコマンド登録エラー:', e);
  }

  // 再起動通知の送信
  for (const guild of client.guilds.cache.values()) {
    const config = globalConfig[guild.id];
    if (config && config.restartNotify) {
      const targetChannelId = config.restartNotifyChannelId || config.logChannelId;
      if (targetChannelId) {
        const channel = guild.channels.cache.get(targetChannelId);
        if (channel) {
          const restartEmbed = new EmbedBuilder()
            .setTitle('🟢 システム再起動完了')
            .setDescription('Botが正常に起動・再起動されました。')
            .setColor(0x00ff00)
            .setTimestamp();
          await channel.send({ embeds: [restartEmbed] }).catch(() => {});
        }
      }
    }
  }

  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.members.fetch();
      await sleep(1000);
    } catch (e) {}
  }

  await scanAllGuilds();
  setInterval(scanAllGuilds, 5 * 60 * 1000);
});

// --- 数字カウンターメッセージ判定 ---
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const countConfig = globalConfig[message.guild.id]?.countConfig;
  if (!countConfig || !countConfig.enabled || countConfig.channelId !== message.channel.id) return;

  const inputTrimmed = message.content.trim();
  const inputNum = parseInt(inputTrimmed, 10);
  const expectedNum = (countConfig.currentNum || 0) + 1;

  if (isNaN(inputNum) || inputTrimmed !== String(inputNum) || inputNum !== expectedNum) {
    if (countConfig.deleteWrong !== false) await message.delete().catch(() => {});
    if (countConfig.warnEmbed !== false) {
      const warnEmbed = new EmbedBuilder()
        .setTitle('⚠️ 数字が間違っています！')
        .setDescription(`<@${message.author.id}> さん、次に送信する正しい数字は **\`${expectedNum}\`** です。`)
        .setColor(0xffa500)
        .setTimestamp();

      const warnMsg = await message.channel.send({ embeds: [warnEmbed] }).catch(() => {});
      if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 5000);
    }
  } else {
    await updateCountConfig(message.guild.id, 'currentNum', expectedNum);
    await message.react('✅').catch(() => {});
  }
});

// --- リアルタイムイベント ---
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const guildConfig = globalConfig[newMember.guild.id];
  if (!guildConfig) return;

  if (guildConfig.enabled) await processMemberRoles(newMember, guildConfig);
  if (guildConfig.addRoleConfig?.enabled) await processAddRolesOnly(newMember, guildConfig.addRoleConfig);
});

client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
  if (!newPresence?.member) return;
  const guildConfig = globalConfig[newPresence.guild.id];
  if (!guildConfig) return;

  if (guildConfig.enabled) await processMemberRoles(newPresence.member, guildConfig);
  if (guildConfig.addRoleConfig?.enabled) await processAddRolesOnly(newPresence.member, guildConfig.addRoleConfig);
});

// --- インタラクション処理 (タイムアウト防止改修) ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await syncConfigFromGithub();
    const cmd = client.commands.get(interaction.commandName);
    if (cmd) await cmd.execute(interaction, globalConfig);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'modal_set_number') {
    await interaction.deferUpdate(); // 3秒タイムアウト防止
    const guildId = interaction.guildId;
    const inputVal = interaction.fields.getTextInputValue('input_current_number');
    const parsedVal = parseInt(inputVal, 10);

    if (isNaN(parsedVal) || parsedVal < 0) {
      return interaction.followUp({ content: '❌ 有効な0以上の半角数字を入力してください。', flags: MessageFlags.Ephemeral });
    }

    const updatedConfig = await updateCountConfig(guildId, 'currentNum', parsedVal);
    const embed = countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig);
    const components = countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig);
    return interaction.editReply({ embeds: [embed], components: components });
  }

  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isButton()) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ この操作はサーバー所有者しかできません。', flags: MessageFlags.Ephemeral });
    }

    // タイムアウトを回避するため即座に応答を保留状態にする
    await interaction.deferUpdate();

    const guildId = interaction.guildId;

    // --- ロール制御パネル ---
    if (interaction.customId === 'select_condition_role') {
      const updatedConfig = await updateGuildConfig(guildId, 'conditionRoleId', interaction.values[0]);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_remove_roles') {
      const updatedConfig = await updateGuildConfig(guildId, 'removeRoleIds', interaction.values);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_add_roles') {
      const updatedConfig = await updateGuildConfig(guildId, 'addRoleIds', interaction.values);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_log_channel') {
      const updatedConfig = await updateGuildConfig(guildId, 'logChannelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_restart_notify_channel') {
      const updatedConfig = await updateGuildConfig(guildId, 'restartNotifyChannelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_restart_notify') {
      const currentConfig = globalConfig[guildId] || {};
      const updatedConfig = await updateGuildConfig(guildId, 'restartNotify', !currentConfig.restartNotify);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_active_button') {
      const currentConfig = globalConfig[guildId] || {};
      if (!currentConfig.enabled && !currentConfig.conditionRoleId) {
        return interaction.followUp({ content: '⚠️ 「1. チェックするロール」を事前に設定してください。', flags: MessageFlags.Ephemeral });
      }
      const updatedConfig = await updateGuildConfig(guildId, 'enabled', !currentConfig.enabled);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }

    // --- カウンターパネル ---
    if (interaction.customId === 'select_count_channel') {
      const updatedConfig = await updateCountConfig(guildId, 'channelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_count_delete') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      const updatedConfig = await updateCountConfig(guildId, 'deleteWrong', !(currentConfig.deleteWrong !== false));
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_count_warn') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      const updatedConfig = await updateCountConfig(guildId, 'warnEmbed', !(currentConfig.warnEmbed !== false));
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_count_active') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      if (!currentConfig.enabled && !currentConfig.channelId) {
        return interaction.followUp({ content: '⚠️ カウント対象のチャンネルを事前に設定してください。', flags: MessageFlags.Ephemeral });
      }
      const updatedConfig = await updateCountConfig(guildId, 'enabled', !currentConfig.enabled);
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig) });
    }

    // --- ロール付与パネル ---
    if (interaction.customId === 'select_add_check_roles') {
      const updatedConfig = await updateAddRoleConfig(guildId, 'checkRoleIds', interaction.values);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, updatedConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_add_target_roles') {
      const updatedConfig = await updateAddRoleConfig(guildId, 'addRoleIds', interaction.values);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, updatedConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_add_role_log_channel') {
      const updatedConfig = await updateAddRoleConfig(guildId, 'logChannelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, updatedConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_role_add_active') {
      const currentConfig = globalConfig[guildId]?.addRoleConfig || {};
      if (!currentConfig.enabled && (!currentConfig.addRoleIds || currentConfig.addRoleIds.length === 0)) {
        return interaction.followUp({ content: '⚠️ 「付与するロール」を1つ以上設定してください。', flags: MessageFlags.Ephemeral });
      }
      const updatedConfig = await updateAddRoleConfig(guildId, 'enabled', !currentConfig.enabled);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, updatedConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, updatedConfig) });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
