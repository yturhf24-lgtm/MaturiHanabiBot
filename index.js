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
  ActionRowBuilder,
  ActivityType // 👈 ActivityType を追加
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

// GitHub からの設定データ取得
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
      saveConfigToGithub();
    }
  } catch (err) {
    console.error('GitHub 同期エラー:', err);
  }
}

// GitHub への設定非同期保存
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
      executionInterval: 'instant', // 'instant' または '5min'
      restartNotify: false,
      restartNotifyChannelId: null,
      conditionRoleId: null,
      hasRoleIds: [],
      removeRoleIds: [],
      addRoleIds: [],
      logChannelId: null,
      countConfig: {
        enabled: false,
        channelId: null,
        currentNum: 0,
        deleteWrong: true,
        warnEmbed: true,
        lastMessageId: null
      },
      addRoleConfig: {
        enabled: false,
        executionInterval: 'instant', // 'instant' または '5min'
        excludeRoleIds: [],
        targetRoleIds: [],
        logChannelId: null
      }
    };
  }
  // 既存データの後方互換プロパティ補完
  if (!globalConfig[guildId].executionInterval) {
    globalConfig[guildId].executionInterval = 'instant';
  }
  if (!globalConfig[guildId].addRoleConfig) {
    globalConfig[guildId].addRoleConfig = {
      enabled: false,
      executionInterval: 'instant',
      excludeRoleIds: [],
      targetRoleIds: [],
      logChannelId: null
    };
  } else if (!globalConfig[guildId].addRoleConfig.executionInterval) {
    globalConfig[guildId].addRoleConfig.executionInterval = 'instant';
  }
}

function updateGuildConfig(guildId, key, value) {
  initGuildConfig(guildId);
  globalConfig[guildId][key] = value;
  saveConfigToGithub();
  return globalConfig;
}

function updateCountConfig(guildId, key, value) {
  initGuildConfig(guildId);
  globalConfig[guildId].countConfig[key] = value;
  saveConfigToGithub();
  return globalConfig;
}

function updateAddRoleConfig(guildId, key, value) {
  initGuildConfig(guildId);
  globalConfig[guildId].addRoleConfig[key] = value;
  saveConfigToGithub();
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
const statusModule = require('./commands/status.js');

client.commands.set(panelModule.data.name, panelModule);
client.commands.set(countPanelModule.data.name, countPanelModule);
client.commands.set(roleAddPanelModule.data.name, roleAddPanelModule);
client.commands.set(statusModule.data.name, statusModule);

const commandsArray = [
  panelModule.data.toJSON(),
  countPanelModule.data.toJSON(),
  roleAddPanelModule.data.toJSON(),
  statusModule.data.toJSON()
];

const processingMembers = new Set();

// --- ステータス（プレイ中）更新処理 ---
function updateBotPresence(client) {
  if (!client.user) return;

  const serverCount = client.guilds.cache.size; // 導入サーバー数
  const ping = Math.round(client.ws.ping);      // WebSocket Ping値

  client.user.setPresence({
    activities: [{
      name: `${serverCount} サーバー | Ping: ${ping}ms`,
      type: ActivityType.Playing
    }],
    status: 'online'
  });
}

// --- 自動ロール処理 ---
async function processMemberRoles(member, guildConfig) {
  const { conditionRoleId, hasRoleIds = [], removeRoleIds = [], addRoleIds = [], logChannelId } = guildConfig;
  if (!conditionRoleId) return false;
  if (processingMembers.has(member.id)) return false;
  if (!member.roles.cache.has(conditionRoleId)) return false;

  if (hasRoleIds.length > 0) {
    const hasAnyRequiredRole = hasRoleIds.some(id => member.roles.cache.has(id));
    if (!hasAnyRequiredRole) return false;
  }

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

async function processAddRolesOnly(member, addRoleConfig) {
  if (!addRoleConfig || !addRoleConfig.enabled) return false;

  const { excludeRoleIds = [], targetRoleIds = [], logChannelId } = addRoleConfig;

  if (!targetRoleIds || targetRoleIds.length === 0) return false;

  if (excludeRoleIds.length > 0) {
    const hasExcluded = excludeRoleIds.some(id => member.roles.cache.has(id));
    if (hasExcluded) return false;
  }

  const rolesToAdd = targetRoleIds.filter(id => !member.roles.cache.has(id));
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

// isPeriodicScan パラメータで定期スキャン時かどうかの判定を行う
async function scanSingleGuild(guild, isPeriodicScan = false) {
  const guildConfig = globalConfig[guild.id];
  if (!guildConfig) return 0;

  let updatedCount = 0;
  const members = guild.members.cache;

  for (const member of members.values()) {
    if (!member.user.bot) {
      // 自動ロール制御: 「定期スキャン時かつ5分間隔指定」または「初期化スキャン時」に処理
      if (guildConfig.enabled && (!isPeriodicScan || guildConfig.executionInterval === '5min')) {
        if (await processMemberRoles(member, guildConfig)) updatedCount++;
      }
      // 条件ロール付与: 「定期スキャン時かつ5分間隔指定」または「初期化スキャン時」に処理
      if (guildConfig.addRoleConfig?.enabled && (!isPeriodicScan || guildConfig.addRoleConfig.executionInterval === '5min')) {
        if (await processAddRolesOnly(member, guildConfig.addRoleConfig)) updatedCount++;
      }
      await sleep(100);
    }
  }

  return updatedCount;
}

async function scanAllGuilds(isPeriodicScan = false) {
  for (const guild of client.guilds.cache.values()) {
    await scanSingleGuild(guild, isPeriodicScan);
  }
}

// --- イベント: ClientReady ---
client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  // 起動時にステータス（プレイ中）を即座に設定
  updateBotPresence(c);

  // 1分（60秒）ごとにステータス（サーバー数とPing）を最新に更新
  setInterval(() => {
    updateBotPresence(c);
  }, 60000);

  await syncConfigFromGithub();

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(c.user.id), { body: commandsArray });
    console.log('✅ スラッシュコマンドを正常に登録しました。');
  } catch (e) {
    console.error('スラッシュコマンド登録エラー:', e);
  }

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

  // 初期スキャン（すべての設定に関わらず全体のチェックを実施）
  await scanAllGuilds(false);
  // 定期スキャン（5分ごとに interval 設定が '5min' の場合のみ処理を行う）
  setInterval(() => scanAllGuilds(true), 5 * 60 * 1000);
});

// --- イベント: リアルタイム ロール更新検知 ---
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (newMember.user.bot) return;

  const guildConfig = globalConfig[newMember.guild.id];
  if (!guildConfig) return;

  const oldRoles = oldMember.roles.cache;
  const newRoles = newMember.roles.cache;
  if (oldRoles.size === newRoles.size && oldRoles.every(role => newRoles.has(role.id))) {
    return;
  }

  // 自動ロール: モードが 'instant' (即時) の場合のみ実行
  if (guildConfig.enabled && (guildConfig.executionInterval || 'instant') === 'instant') {
    await processMemberRoles(newMember, guildConfig);
  }
  // 条件ロール: モードが 'instant' (即時) の場合のみ実行
  if (guildConfig.addRoleConfig?.enabled && (guildConfig.addRoleConfig.executionInterval || 'instant') === 'instant') {
    await processAddRolesOnly(newMember, guildConfig.addRoleConfig);
  }
});

// --- 数字カウンター: メッセージ送信時（即座に判定） ---
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
    updateCountConfig(message.guild.id, 'currentNum', expectedNum);
    updateCountConfig(message.guild.id, 'lastMessageId', message.id);
    await message.react('✅').catch(() => {});
  }
});

// --- 数字カウンター: メッセージ編集監視（即座に検知・判定） ---
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (newMessage.author?.bot || !newMessage.guild) return;

  const guildId = newMessage.guild.id;
  const countConfig = globalConfig[guildId]?.countConfig;
  if (!countConfig || !countConfig.enabled || countConfig.channelId !== newMessage.channel.id) return;

  if (countConfig.lastMessageId === newMessage.id) {
    const inputTrimmed = newMessage.content ? newMessage.content.trim() : '';
    const inputNum = parseInt(inputTrimmed, 10);

    if (isNaN(inputNum) || inputTrimmed !== String(inputNum) || inputNum !== countConfig.currentNum) {
      await newMessage.delete().catch(() => {});

      const prevNum = Math.max(0, countConfig.currentNum - 1);
      updateCountConfig(guildId, 'currentNum', prevNum);
      updateCountConfig(guildId, 'lastMessageId', null);

      const nextNum = prevNum + 1;

      const warnEmbed = new EmbedBuilder()
        .setTitle('⚠️ カウントメッセージが編集されました')
        .setDescription(
          `<@${newMessage.author.id}> さんがカウントメッセージを編集したため即座に無効化しました。\n\n` +
          `以前のプレイヤーが成功させた数字: **\`${prevNum}\`**\n` +
          `次に送信する正しい数字: **\`${nextNum}\`**`
        )
        .setColor(0xff0000)
        .setTimestamp();

      const warnMsg = await newMessage.channel.send({ embeds: [warnEmbed] }).catch(() => {});
      if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
    }
  }
});

// --- 数字カウンター: メッセージ削除監視（即座に検知・判定） ---
client.on(Events.MessageDelete, async (message) => {
  if (!message.guild) return;

  const guildId = message.guild.id;
  const countConfig = globalConfig[guildId]?.countConfig;
  if (!countConfig || !countConfig.enabled || countConfig.channelId !== message.channel.id) return;

  if (countConfig.lastMessageId === message.id) {
    const prevNum = Math.max(0, countConfig.currentNum - 1);
    updateCountConfig(guildId, 'currentNum', prevNum);
    updateCountConfig(guildId, 'lastMessageId', null);

    const nextNum = prevNum + 1;

    const warnEmbed = new EmbedBuilder()
      .setTitle('🗑️ カウントメッセージが削除されました')
      .setDescription(
        `直前のカウントメッセージが削除されたため、即座にカウントを巻き戻しました。\n\n` +
        `以前のプレイヤーが成功させた数字: **\`${prevNum}\`**\n` +
        `次に送信する正しい数字: **\`${nextNum}\`**`
      )
      .setColor(0xffa500)
      .setTimestamp();

    const warnMsg = await message.channel.send({ embeds: [warnEmbed] }).catch(() => {});
    if (warnMsg) setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
  }
});

// --- インタラクション制御 ---
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.guild && !client.guilds.cache.has(interaction.guild.id)) {
    return interaction.reply({
      content: '❌ このBotがサーバー内に存在しないか権限が無いため、操作を行えません。',
      flags: MessageFlags.Ephemeral
    }).catch(() => {});
  }

  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) {
      return interaction.reply({
        content: '❌ このBotが存在しないか、機能が有効化されていないため /コマンド は使えません。',
        flags: MessageFlags.Ephemeral
      });
    }
    await cmd.execute(interaction, globalConfig);
    return;
  }

  if (interaction.isButton() && interaction.customId === 'open_set_number_modal') {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ この操作はサーバー所有者しかできません。', flags: MessageFlags.Ephemeral });
    }

    const currentNum = globalConfig[interaction.guildId]?.countConfig?.currentNum ?? 0;

    const modal = new ModalBuilder()
      .setCustomId('set_number_modal')
      .setTitle('現在のカウント数字を変更');

    const numberInput = new TextInputBuilder()
      .setCustomId('new_count_number')
      .setLabel('変更後の数字（次に送信すべき数字はこれ+1）')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`現在の数字: ${currentNum}`)
      .setValue(String(currentNum))
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(numberInput));
    return interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'set_number_modal') {
    await interaction.deferUpdate();

    const inputVal = interaction.fields.getTextInputValue('new_count_number').trim();
    const newNum = parseInt(inputVal, 10);

    if (isNaN(newNum)) {
      return interaction.followUp({ content: '⚠️ 半角数字のみ入力してください。', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;
    updateCountConfig(guildId, 'currentNum', newNum);

    return interaction.editReply({
      embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, globalConfig)],
      components: countPanelModule.buildCountPanelComponents(interaction.guild, globalConfig)
    });
  }

  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isButton()) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ この操作はサーバー所有者しかできません。', flags: MessageFlags.Ephemeral });
    }

    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    initGuildConfig(guildId);

    // ロール自動制御パネル
    if (interaction.customId === 'select_condition_role') {
      updateGuildConfig(guildId, 'conditionRoleId', interaction.values[0]);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, globalConfig)], components: panelModule.buildPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'select_has_roles') {
      updateGuildConfig(guildId, 'hasRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, globalConfig)], components: panelModule.buildPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'select_remove_roles') {
      updateGuildConfig(guildId, 'removeRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, globalConfig)], components: panelModule.buildPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'select_add_roles') {
      updateGuildConfig(guildId, 'addRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, globalConfig)], components: panelModule.buildPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'select_log_channel') {
      updateGuildConfig(guildId, 'logChannelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, globalConfig)], components: panelModule.buildPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'toggle_restart_notify') {
      const currentNotifyState = globalConfig[guildId]?.restartNotify || false;
      updateGuildConfig(guildId, 'restartNotify', !currentNotifyState);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, globalConfig)], components: panelModule.buildPanelComponents(interaction.guild, globalConfig) });
    }
    // 実行タイミング切替 (自動ロール制御)
    if (interaction.customId === 'toggle_interval') {
      const currentInterval = globalConfig[guildId]?.executionInterval || 'instant';
      const nextInterval = currentInterval === 'instant' ? '5min' : 'instant';
      updateGuildConfig(guildId, 'executionInterval', nextInterval);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, globalConfig)], components: panelModule.buildPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'toggle_active_button') {
      const currentConfig = globalConfig[guildId] || {};
      if (!currentConfig.enabled && !currentConfig.conditionRoleId) {
        return interaction.followUp({ content: '⚠️ 「1. チェックするロール」を事前に設定してください。', flags: MessageFlags.Ephemeral });
      }
      updateGuildConfig(guildId, 'enabled', !currentConfig.enabled);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, globalConfig)], components: panelModule.buildPanelComponents(interaction.guild, globalConfig) });
    }

    // カウンターパネル
    if (interaction.customId === 'select_count_channel') {
      updateCountConfig(guildId, 'channelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, globalConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'toggle_count_delete') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      updateCountConfig(guildId, 'deleteWrong', !(currentConfig.deleteWrong !== false));
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, globalConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'toggle_count_warn') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      updateCountConfig(guildId, 'warnEmbed', !(currentConfig.warnEmbed !== false));
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, globalConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'toggle_count_active') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      if (!currentConfig.enabled && !currentConfig.channelId) {
        return interaction.followUp({ content: '⚠️ カウント対象のチャンネルを事前に設定してください。', flags: MessageFlags.Ephemeral });
      }
      updateCountConfig(guildId, 'enabled', !currentConfig.enabled);
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, globalConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, globalConfig) });
    }

    // 条件ロール自動付与パネル
    if (interaction.customId === 'select_add_exclude_roles') {
      updateAddRoleConfig(guildId, 'excludeRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, globalConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'select_add_target_roles') {
      updateAddRoleConfig(guildId, 'targetRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, globalConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'select_add_role_log_channel') {
      updateAddRoleConfig(guildId, 'logChannelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, globalConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, globalConfig) });
    }
    // 実行タイミング切替 (条件ロール自動付与)
    if (interaction.customId === 'toggle_role_add_interval') {
      const currentInterval = globalConfig[guildId]?.addRoleConfig?.executionInterval || 'instant';
      const nextInterval = currentInterval === 'instant' ? '5min' : 'instant';
      updateAddRoleConfig(guildId, 'executionInterval', nextInterval);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, globalConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, globalConfig) });
    }
    if (interaction.customId === 'toggle_role_add_active') {
      const currentConfig = globalConfig[guildId]?.addRoleConfig || {};
      updateAddRoleConfig(guildId, 'enabled', !currentConfig.enabled);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, globalConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, globalConfig) });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
