const { 
  Client, 
  GatewayIntentBits, 
  Events, 
  Collection, 
  EmbedBuilder, 
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');

// 設定ファイルのパス
const CONFIG_PATH = path.join(__dirname, 'config.json');

// 設定データの読み込み・保存関数
function loadGlobalConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('設定ファイルの読み込みエラー:', err);
  }
  return {};
}

function saveGlobalConfig(config) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('設定ファイルの保存エラー:', err);
  }
}

// グローバル設定オブジェクト
const globalConfig = loadGlobalConfig();

// 【★ここを修正★】 commands/ 内のパネルモジュールを読み込み
const panelModule = require('./commands/panel.js');
const countPanelModule = require('./commands/countPanel.js');
const roleAddPanelModule = require('./commands/roleAddPanel.js');

// Helper: 各設定の初期化と更新
function initGuildConfig(guildId) {
  if (!globalConfig[guildId]) {
    globalConfig[guildId] = {
      enabled: false,
      conditionRoleId: null,
      hasRoleIds: [],
      removeRoleIds: [],
      addRoleIds: [],
      logChannelId: null,
      restartNotify: false,
      countConfig: {
        enabled: false,
        channelId: null,
        currentNum: 0,
        deleteWrong: true,
        warnEmbed: true
      },
      addRoleConfig: {
        enabled: false,
        excludeRoleIds: [],
        targetRoleIds: [],
        logChannelId: null
      }
    };
  }
}

function updateGuildConfig(guildId, key, value) {
  initGuildConfig(guildId);
  globalConfig[guildId][key] = value;
  saveGlobalConfig(globalConfig);
  return globalConfig;
}

function updateCountConfig(guildId, key, value) {
  initGuildConfig(guildId);
  if (!globalConfig[guildId].countConfig) {
    globalConfig[guildId].countConfig = { enabled: false, channelId: null, currentNum: 0, deleteWrong: true, warnEmbed: true };
  }
  globalConfig[guildId].countConfig[key] = value;
  saveGlobalConfig(globalConfig);
  return globalConfig;
}

function updateAddRoleConfig(guildId, key, value) {
  initGuildConfig(guildId);
  if (!globalConfig[guildId].addRoleConfig) {
    globalConfig[guildId].addRoleConfig = { enabled: false, excludeRoleIds: [], targetRoleIds: [], logChannelId: null };
  }
  globalConfig[guildId].addRoleConfig[key] = value;
  saveGlobalConfig(globalConfig);
  return globalConfig;
}

// Client の作成
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// コマンドコレクションの読み込み
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    }
  }
}

// --- Ready イベント ---
client.once(Events.ClientReady, async (c) => {
  console.log(`🤖 ログイン完了: ${c.user.tag}`);

  // 再起動通知処理
  for (const [guildId, cfg] of Object.entries(globalConfig)) {
    if (cfg.restartNotify && cfg.logChannelId) {
      try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) continue;
        const channel = await guild.channels.fetch(cfg.logChannelId).catch(() => null);
        if (channel && channel.isTextBased()) {
          const embed = new EmbedBuilder()
            .setTitle('🔄 Bot再起動完了')
            .setDescription('Botの再起動・アップデートが完了し、正常に稼働しています。')
            .setColor(0x2ecc71)
            .setTimestamp();
          await channel.send({ embeds: [embed] }).catch(() => {});
        }
      } catch (e) {
        console.error(`再起動通知送信エラー (${guildId}):`, e);
      }
    }
  }
});

// --- インタラクション（スラッシュコマンド・パネル操作）制御 ---
client.on(Events.InteractionCreate, async (interaction) => {
  // 1. DMやBot未参加サーバーでの実行を一括ガード
  if (!interaction.guild || !interaction.guild.members.me) {
    if (interaction.isRepliable()) {
      return interaction.reply({
        content: '❌ このサーバーにはBotが導入されていないため、コマンドは使用できません。',
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
    return;
  }

  // 2. スラッシュコマンド実行処理
  if (interaction.isChatInputCommand()) {
    const cmd = client.commands.get(interaction.commandName);
    if (!cmd) return;

    try {
      await cmd.execute(interaction, globalConfig);
    } catch (err) {
      console.error(`コマンド実行エラー (${interaction.commandName}):`, err);
      const errorMessage = {
        content: '❌ コマンドの実行中にエラーが発生しました。',
        flags: MessageFlags.Ephemeral
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMessage).catch(() => {});
      } else {
        await interaction.reply(errorMessage).catch(() => {});
      }
    }
    return;
  }

  // 3. ボタン・セレクトメニュー操作処理
  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isButton()) {
    // サーバー所有者のみ操作可能
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ 
        content: '❌ この操作はサーバー所有者しかできません。', 
        flags: MessageFlags.Ephemeral 
      });
    }

    await interaction.deferUpdate();

    const guildId = interaction.guildId;
    initGuildConfig(guildId);

    // --- ① ロール自動制御パネル ---
    if (interaction.customId === 'select_condition_role') {
      const updatedConfig = updateGuildConfig(guildId, 'conditionRoleId', interaction.values[0]);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_has_roles') {
      const updatedConfig = updateGuildConfig(guildId, 'hasRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_remove_roles') {
      const updatedConfig = updateGuildConfig(guildId, 'removeRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_add_roles') {
      const updatedConfig = updateGuildConfig(guildId, 'addRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_log_channel') {
      const updatedConfig = updateGuildConfig(guildId, 'logChannelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_restart_notify') {
      const currentNotifyState = globalConfig[guildId]?.restartNotify || false;
      const updatedConfig = updateGuildConfig(guildId, 'restartNotify', !currentNotifyState);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_active_button') {
      const currentConfig = globalConfig[guildId] || {};
      if (!currentConfig.enabled && !currentConfig.conditionRoleId) {
        return interaction.followUp({ content: '⚠️ 「1. チェックするロール」を事前に設定してください。', flags: MessageFlags.Ephemeral });
      }
      const updatedConfig = updateGuildConfig(guildId, 'enabled', !currentConfig.enabled);
      return interaction.editReply({ embeds: [panelModule.buildPanelEmbed(interaction.guild, updatedConfig)], components: panelModule.buildPanelComponents(interaction.guild, updatedConfig) });
    }

    // --- ② カウンターパネル ---
    if (interaction.customId === 'select_count_channel') {
      const updatedConfig = updateCountConfig(guildId, 'channelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_count_delete') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      const updatedConfig = updateCountConfig(guildId, 'deleteWrong', !(currentConfig.deleteWrong !== false));
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig)], components: countPanelPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_count_warn') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      const updatedConfig = updateCountConfig(guildId, 'warnEmbed', !(currentConfig.warnEmbed !== false));
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_count_active') {
      const currentConfig = globalConfig[guildId]?.countConfig || {};
      if (!currentConfig.enabled && !currentConfig.channelId) {
        return interaction.followUp({ content: '⚠️ カウント対象のチャンネルを事前に設定してください。', flags: MessageFlags.Ephemeral });
      }
      const updatedConfig = updateCountConfig(guildId, 'enabled', !currentConfig.enabled);
      return interaction.editReply({ embeds: [countPanelModule.buildCountPanelEmbed(interaction.guild, updatedConfig)], components: countPanelModule.buildCountPanelComponents(interaction.guild, updatedConfig) });
    }

    // --- ③ 条件ロール自動付与パネル ---
    if (interaction.customId === 'select_add_exclude_roles') {
      const updatedConfig = updateAddRoleConfig(guildId, 'excludeRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, updatedConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_add_target_roles') {
      const updatedConfig = updateAddRoleConfig(guildId, 'targetRoleIds', interaction.values || []);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, updatedConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'select_add_role_log_channel') {
      const updatedConfig = updateAddRoleConfig(guildId, 'logChannelId', interaction.values[0] || null);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, updatedConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, updatedConfig) });
    }
    if (interaction.customId === 'toggle_role_add_active') {
      const currentConfig = globalConfig[guildId]?.addRoleConfig || {};
      const updatedConfig = updateAddRoleConfig(guildId, 'enabled', !currentConfig.enabled);
      return interaction.editReply({ embeds: [roleAddPanelModule.buildRoleAddPanelEmbed(interaction.guild, updatedConfig)], components: roleAddPanelModule.buildRoleAddPanelComponents(interaction.guild, updatedConfig) });
    }
  }
});

// --- メンバー更新イベント (ロール変更監視) ---
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  const guildId = newMember.guild.id;
  const cfg = globalConfig[guildId];
  if (!cfg) return;

  // 1. ロール自動制御機能
  if (cfg.enabled && cfg.conditionRoleId) {
    const hadCondition = oldMember.roles.cache.has(cfg.conditionRoleId);
    const hasCondition = newMember.roles.cache.has(cfg.conditionRoleId);

    // 条件ロールが付与された瞬間
    if (!hadCondition && hasCondition) {
      // 指定された所有ロールをすべて持っているか判定（空の場合は全対象）
      const hasAllRequired = !cfg.hasRoleIds || cfg.hasRoleIds.length === 0 || 
        cfg.hasRoleIds.every(roleId => newMember.roles.cache.has(roleId));

      if (hasAllRequired) {
        const removedRoleNames = [];
        const addedRoleNames = [];

        // 剥奪ロール処理
        if (cfg.removeRoleIds && cfg.removeRoleIds.length > 0) {
          for (const roleId of cfg.removeRoleIds) {
            if (newMember.roles.cache.has(roleId)) {
              const role = newMember.guild.roles.cache.get(roleId);
              if (role) {
                await newMember.roles.remove(roleId).catch(() => {});
                removedRoleNames.push(role.name);
              }
            }
          }
        }

        // 付与ロール処理
        if (cfg.addRoleIds && cfg.addRoleIds.length > 0) {
          for (const roleId of cfg.addRoleIds) {
            if (!newMember.roles.cache.has(roleId)) {
              const role = newMember.guild.roles.cache.get(roleId);
              if (role) {
                await newMember.roles.add(roleId).catch(() => {});
                addedRoleNames.push(role.name);
              }
            }
          }
        }

        // ログ出力
        if (cfg.logChannelId && (removedRoleNames.length > 0 || addedRoleNames.length > 0)) {
          const logChannel = newMember.guild.channels.cache.get(cfg.logChannelId);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('⚙️ ロール自動制御 実行ログ')
              .setColor(0x3498db)
              .addFields(
                { name: '対象ユーザー', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: false },
                { name: '剥奪されたロール', value: removedRoleNames.length > 0 ? removedRoleNames.join(', ') : 'なし', inline: true },
                { name: '付与されたロール', value: addedRoleNames.length > 0 ? addedRoleNames.join(', ') : 'なし', inline: true }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      }
    }
  }

  // 2. 条件ロール自動付与機能 (トリガー監視)
  const addCfg = cfg.addRoleConfig;
  if (addCfg && addCfg.enabled && addCfg.targetRoleIds && addCfg.targetRoleIds.length > 0) {
    const oldRoleIds = new Set(oldMember.roles.cache.keys());
    const newRoleIds = new Set(newMember.roles.cache.keys());

    // ロールが何か新しく追加されたか判定
    if (newRoleIds.size > oldRoleIds.size) {
      // 除外ロールを持っているかチェック
      const hasExcludeRole = addCfg.excludeRoleIds && addCfg.excludeRoleIds.some(id => newMember.roles.cache.has(id));

      if (!hasExcludeRole) {
        const addedNames = [];
        for (const targetId of addCfg.targetRoleIds) {
          if (!newMember.roles.cache.has(targetId)) {
            const role = newMember.guild.roles.cache.get(targetId);
            if (role) {
              await newMember.roles.add(targetId).catch(() => {});
              addedNames.push(role.name);
            }
          }
        }

        if (addedNames.length > 0 && addCfg.logChannelId) {
          const logChannel = newMember.guild.channels.cache.get(addCfg.logChannelId);
          if (logChannel && logChannel.isTextBased()) {
            const logEmbed = new EmbedBuilder()
              .setTitle('➕ 条件ロール自動付与 実行ログ')
              .setColor(0x2ecc71)
              .addFields(
                { name: '対象ユーザー', value: `${newMember.user.tag} (<@${newMember.id}>)`, inline: false },
                { name: '付与されたロール', value: addedNames.join(', '), inline: false }
              )
              .setTimestamp();
            await logChannel.send({ embeds: [logEmbed] }).catch(() => {});
          }
        }
      }
    }
  }
});

// --- メッセージ処理 (数字カウンター機能) ---
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const countCfg = globalConfig[guildId]?.countConfig;

  if (!countCfg || !countCfg.enabled || !countCfg.channelId) return;
  if (message.channel.id !== countCfg.channelId) return;

  const inputNum = parseInt(message.content.trim(), 10);
  const expectedNum = (countCfg.currentNum ?? 0) + 1;

  // 入力が数字かつ正解の場合
  if (!isNaN(inputNum) && inputNum === expectedNum && /^\d+$/.test(message.content.trim())) {
    countCfg.currentNum = expectedNum;
    saveGlobalConfig(globalConfig);
    await message.react('✅').catch(() => {});
  } else {
    // 不正解・誤爆メッセージの場合
    if (countCfg.deleteWrong !== false) {
      await message.delete().catch(() => {});
    }

    if (countCfg.warnEmbed !== false) {
      const warnEmbed = new EmbedBuilder()
        .setTitle('⚠️ カウントエラー')
        .setDescription(`${message.author} さん、入力が正しくありません。\n次に送信する数字は **\`${expectedNum}\`** です。`)
        .setColor(0xe74c3c)
        .setTimestamp();

      const warnMsg = await message.channel.send({ embeds: [warnEmbed] }).catch(() => null);
      if (warnMsg) {
        setTimeout(() => {
          warnMsg.delete().catch(() => {});
        }, 5000);
      }
    }
  }
});

// --- Render環境等でのWebサーバー維持 (Keep-Alive) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running safely!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web サーバー起動 (Port: ${PORT})`);
});

// Botログイン
client.login(process.env.DISCORD_TOKEN);
