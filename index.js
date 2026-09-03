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
  ActionRowBuilder // 👈 追加！
} = require('discord.js');

// --- Express サーバー (Render等の常時起動用) ---
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
  if (!GITHUB_TOKEN) {
    console.warn('⚠️ GITHUB_TOKEN が設定されていません。メモリ上でのみ設定を保持します。');
    return;
  }
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
      console.log('ℹ️ GitHub 上に config.json が見つかりません。新規作成します...');
      globalConfig = {};
      await saveConfigToGithub();
    } else {
      console.error(`GitHub 同期失敗 (${res.status}):`, await res.text());
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
    const putRes = await fetch(url, {
      method: 'PUT',
      headers,
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
      console.error(`GitHub 保存失敗 (${putRes.status}):`, await putRes.text());
    }
  } catch (err) {
    console.error('GitHub 保存エラー:', err);
  }
}

// サーバー全般設定の更新
async function updateGuildConfig(guildId, key, value) {
  if (!globalConfig[guildId]) {
    globalConfig[guildId] = {
      enabled: false,
      restartNotify: false,
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
      }
    };
  }

  globalConfig[guildId][key] = value;
  await saveConfigToGithub();
  return globalConfig;
}

// 数字カウンター専用設定の更新
async function updateCountConfig(guildId, key, value) {
  if (!globalConfig[guildId]) {
    await updateGuildConfig(guildId, 'enabled', false);
  }
  if (!globalConfig[guildId].countConfig) {
    globalConfig[guildId].countConfig = {
      enabled: false,
      channelId: null,
      currentNum: 0,
      deleteWrong: true,
      warnEmbed: true
    };
  }

  globalConfig[guildId].countConfig[key] = value;
  await saveConfigToGithub();
  return globalConfig;
}

// --- Discord Bot クライアントの初期化 ---
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

// コマンドモジュールの読み込み
const panelModule = require('./commands/panel.js');
const countPanelModule = require('./commands/countPanel.js');

client.commands.set(panelModule.data.name, panelModule);
client.commands.set(countPanelModule.data.name, countPanelModule);

const commandsArray = [
  panelModule.data.toJSON(),
  countPanelModule.data.toJSON()
];

// レート制限対応セーフティラッパー
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
      console.error('操作エラー:', error);
    }
  }
}

// メンバー個別の自動ロール判定＆処理
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

// レート制限回避のためキャッシュベースでスキャン
async function scanSingleGuild(guild) {
  const guildConfig = globalConfig[guild.id];
  if (!guildConfig || !guildConfig.enabled || !guildConfig.conditionRoleId) return 0;

  let updatedCount = 0;
  try {
    const members = guild.members.cache;
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
    console.error(`Guild scan error (${guild.id}):`, err);
  }

  return updatedCount;
}

async function scanAllGuilds() {
  for (const guild of client.guilds.cache.values()) {
    await scanSingleGuild(guild);
  }
}

// 起動時の再起動通知送信
async function sendRestartNotifications() {
  for (const guild of client.guilds.cache.values()) {
    const c = globalConfig[guild.id];
    if (c && c.restartNotify && c.logChannelId) {
      const channel = guild.channels.cache.get(c.logChannelId);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle('🚀 Bot再起動完了')
          .setDescription('Botが正常に起動・再接続されました。自動チェックを開始します。')
          .setColor(0x3498db)
          .setTimestamp();

        await safeRoleAction(() => channel.send({ embeds: [embed] }));
      }
    }
  }
}

// --- 起動イベント ---
client.once(Events.ClientReady, async (c) => {
  console.log(`Logged in as ${c.user.tag}`);

  await syncConfigFromGithub();

  // スラッシュコマンドの一括登録
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(c.user.id), { body: commandsArray });
    console.log('✅ スラッシュコマンドを正常に登録しました。');
  } catch (e) {
    console.error('スラッシュコマンド登録エラー:', e);
  }

  await sendRestartNotifications();

  // 起動時に全サーバーのメンバーを安全に1回だけ取得
  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.members.fetch();
      await sleep(1000);
    } catch (e) {
      console.error(`Initial member fetch failed for ${guild.id}:`, e);
    }
  }

  await scanAllGuilds();

  // 5分（300,000ms）ごとに定期チェック（レート制限対策）
  setInterval(async () => {
    await scanAllGuilds();
  }, 5 * 60 * 1000);
});

// --- 数字カウンターメッセージ判定イベント ---
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const countConfig = globalConfig[message.guild.id]?.countConfig;
  if (!countConfig || !countConfig.enabled || countConfig.channelId !== message.channel.id) return;

  const inputTrimmed = message.content.trim();
  const inputNum = parseInt(inputTrimmed, 10);
  const expectedNum = (countConfig.currentNum || 0) + 1;

  // 不正な数字・テキストの場合
  if (isNaN(inputNum) || inputTrimmed !== String(inputNum) || inputNum !== expectedNum) {
    // 削除が有効な場合
    if (countConfig.deleteWrong !== false) {
      try {
        await message.delete();
      } catch (err) {
        console.error('メッセージ削除権限不足:', err);
      }
    }

    // 警告Embedが有効な場合
    if (countConfig.warnEmbed !== false) {
      const warnEmbed = new EmbedBuilder()
        .setTitle('⚠️ 数字が間違っています！')
        .setDescription(`<@${message.author.id}> さん、次に送信する正しい数字は **\`${expectedNum}\`** です。`)
        .setColor(0xffa500)
        .setTimestamp();

      try {
        const warnMsg = await message.channel.send({ embeds: [warnEmbed] });
        setTimeout(() => {
          warnMsg.delete().catch(() => {});
        }, 5000);
      } catch (err) {}
    }
  } else {
    // 正しい数字の場合
    await updateCountConfig(message.guild.id, 'currentNum', expectedNum);
    await message.react('✅').catch(() => {});
  }
});

// --- リアルタイム判定イベント ---
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const guildConfig = globalConfig[newMember.guild.id];
  if (guildConfig && guildConfig.enabled) {
    await processMemberRoles(newMember, guildConfig);
  }
});

client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
  if (!newPresence || !newPresence.member) return;
  const guildConfig = globalConfig[newPresence.guild.id];
  if (guildConfig && guildConfig.enabled) {
    await processMemberRoles(newPresence.member, guildConfig);
  }
});

// --- インタラクション（コマンド・ボタン・メニュー・モーダル）統合処理 ---
client.on(Events.InteractionCreate, async (interaction) => {
  // 1. スラッシュコマンド
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'panel') {
      await syncConfigFromGithub();
      const cmd = client.commands.get('panel');
      if (cmd) await cmd.execute(interaction, globalConfig);
      return;
    }
    if (interaction.commandName === 'count-panel') {
      await syncConfigFromGithub();
      const cmd = client.commands.get('count-panel');
      if (cmd) await cmd.execute(interaction, globalConfig);
      return;
    }
  }

  // 2. 数字設定モーダルの送信結果受取
  if (interaction.isModalSubmit() && interaction.customId === 'modal_set_number') {
    const guildId = interaction.guildId;
    const inputVal = interaction.fields.getTextInputValue('input_current_number');
    const parsedVal = parseInt(inputVal, 10);

    if (isNaN(parsedVal) || parsedVal < 0) {
      return interaction.reply({ content: '❌ 有効な0以上の半角数字を入力してください。', flags: MessageFlags.Ephemeral });
    }

    const updatedConfig = await updateCountConfig(guildId, 'currentNum', parsedVal);
    const embed = countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig);
    const components = countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig);

    return interaction.update({ embeds: [embed], components: components });
  }

  // 3. パネル操作（所有者判定）
  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isButton()) {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ この操作はサーバー所有者しかできません。', flags: MessageFlags.Ephemeral });
    }

    const guildId = interaction.guildId;

    // --- ロール制御パネル ---
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
      const updatedConfig = await updateGuildConfig(guildId, 'enabled', !currentConfig.enabled);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'toggle_restart_notify_button') {
      const currentConfig = globalConfig[guildId] || {};
      const updatedConfig = await updateGuildConfig(guildId, 'restartNotify', !currentConfig.restartNotify);
      const embed = panelModule.buildPanelEmbed(interaction.guild, updatedConfig);
      const components = panelModule.buildPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    // --- カウンターパネル ---
    if (interaction.customId === 'select_count_channel') {
      const selectedChannel = interaction.values[0] || null;
      const updatedConfig = await updateCountConfig(guildId, 'channelId', selectedChannel);
      const embed = countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig);
      const components = countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'open_set_number_modal') {
      const modal = new ModalBuilder()
        .setCustomId('modal_set_number')
        .setTitle('現在のカウント数字を入力');

      const numInput = new TextInputBuilder()
        .setCustomId('input_current_number')
        .setLabel('数字を入力（例: 0 にすると次は 1）')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('0')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(numInput));
      return interaction.showModal(modal);
    }

    if (interaction.customId === 'toggle_count_delete') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      const currentDeleteState = currentConfig.deleteWrong !== false;
      const updatedConfig = await updateCountConfig(guildId, 'deleteWrong', !currentDeleteState);

      const embed = countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig);
      const components = countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'toggle_count_warn') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      const currentWarnState = currentConfig.warnEmbed !== false;
      const updatedConfig = await updateCountConfig(guildId, 'warnEmbed', !currentWarnState);

      const embed = countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig);
      const components = countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }

    if (interaction.customId === 'toggle_count_active') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};

      if (!currentConfig.enabled && !currentConfig.channelId) {
        return interaction.reply({ content: '⚠️ カウント対象のチャンネルを事前に設定してください。', flags: MessageFlags.Ephemeral });
      }

      const updatedConfig = await updateCountConfig(guildId, 'enabled', !currentConfig.enabled);
      const embed = countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig);
      const components = countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig);
      return interaction.update({ embeds: [embed], components: components });
    }
  }
});

// Bot ログイン
client.login(process.env.DISCORD_TOKEN);
