const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Collection, MessageFlags, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'yturhf24-lgtm';
const REPO_NAME = 'MaturiHanabiBot';
const BRANCH = 'main';

console.log('[Init] スクリプトを読み込み中...');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ]
});

client.commands = new Collection();

const DATA_FILE = path.resolve(__dirname, 'data.json');
let localSettingsCache = {};

let isBotStarted = false;

// -------------------------------------------------------------
// 📁 GitHub連携型 data.json 管理システム
// -------------------------------------------------------------
async function loadDataFromGitHub() {
  console.log('[Data Load] データを読み込み中...');
  try {
    if (GITHUB_TOKEN) {
      const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data.json?ref=${BRANCH}`, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Discord-Bot'
        }
      });
      if (res.ok) {
        const fileData = await res.json();
        const content = Buffer.from(fileData.content, 'base64').toString('utf8');
        localSettingsCache = JSON.parse(content);
        fs.writeFileSync(DATA_FILE, content, 'utf8');
        console.log('[Data Load] GitHubから最新の data.json を読み込みました');
        return;
      } else {
        console.log(`[Data Load Warning] GitHubからの取得に失敗しました (Status: ${res.status})`);
      }
    } else {
      console.log('[Data Load Info] GITHUB_TOKEN が設定されていません。ローカルを使用します。');
    }
  } catch (e) {
    console.error('[Data Load Warning] GitHubからの読み込みに失敗しました:', e);
  }

  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify({}, null, 2), 'utf8');
    }
    const fileContent = fs.readFileSync(DATA_FILE, 'utf8');
    localSettingsCache = JSON.parse(fileContent);
    console.log('[Data Load] ローカルから data.json を読み込みました');
  } catch (e) {
    console.error('[Data Error] 初期化エラー:', e);
    localSettingsCache = {};
  }
}

client.getSettings = () => localSettingsCache;

client.saveSettings = async (data) => {
  localSettingsCache = data;
  const jsonString = JSON.stringify(data, null, 2);
  
  try {
    fs.writeFileSync(DATA_FILE, jsonString, 'utf8');
  } catch (e) {
    console.error('[Local Save Error]:', e);
  }

  if (!GITHUB_TOKEN) return;

  try {
    const getRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data.json?ref=${BRANCH}`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Discord-Bot'
      }
    });
    
    let sha = '';
    if (getRes.ok) {
      const fileInfo = await getRes.json();
      sha = fileInfo.sha;
    }

    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/data.json`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Discord-Bot',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: 'Auto-update data.json from Bot',
        content: Buffer.from(jsonString, 'utf8').toString('base64'),
        sha: sha,
        branch: BRANCH
      })
    });
  } catch (e) {
    console.error('[GitHub Sync Exception]:', e);
  }
};

// コマンドファイルの自動読み込み
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

function getMentionString(roleId, guildId) {
  if (!roleId) return null;
  if (roleId === 'everyone' || roleId === '@everyone' || roleId === guildId) {
    return '@everyone';
  }
  return `<@&${roleId}>`;
}

client.once('clientReady', async (c) => {
  console.log(`🟢 Bot ログイン完了: ${c.user.tag}`);
  console.log(`[DEBUG] 参加サーバー数: ${client.guilds.cache.size}`);

  const settings = client.getSettings();
  for (const [guildId, guildSettings] of Object.entries(settings)) {
    const config = guildSettings?.restartNotify;
    if (config && config.enabled && config.channelId) {
      try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (guild) {
          const channel = await guild.channels.fetch(config.channelId).catch(() => null);
          if (channel) {
            const mentionContent = getMentionString(config.mentionRoleId, guildId);
            const bootEmbed = new EmbedBuilder()
              .setColor(0x00FF00)
              .setTitle('🟢 Botがオンラインになりました')
              .setDescription('Botのシステムが正常に起動・再接続されました。')
              .setTimestamp();

            await channel.send({ 
              content: mentionContent, 
              embeds: [bootEmbed] 
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error(`[Boot Log Error] サーバーID ${guildId}:`, e);
      }
    }
  }

  let statusToggle = false;
  setInterval(() => {
    const guildCount = client.guilds.cache.size;
    let totalMembers = 0;
    client.guilds.cache.forEach(guild => { totalMembers += guild.memberCount || 0; });

    if (statusToggle) {
      client.user.setActivity({ name: `導入プレイヤー数: ${totalMembers}人`, type: 3 });
    } else {
      client.user.setActivity({ name: `Ping ${client.ws.ping}ms | ${guildCount} Servers`, type: 3 });
    }
    statusToggle = !statusToggle;
  }, 10000);

  setTimeout(() => {
    isBotStarted = true;
    console.log('[Bot Monitor] 起動シーケンス完了。');
  }, 8000);
});

client.on('presenceUpdate', async (oldPresence, newPresence) => {
  if (!isBotStarted) return;
  if (!newPresence || !newPresence.user || !newPresence.user.bot) return;

  const guildId = newPresence.guild.id;
  const settings = client.getSettings();
  const config = settings[guildId]?.botMonitor;

  if (!config || !config.enabled || !config.channelId) return;

  const oldStatus = oldPresence ? oldPresence.status : 'offline';
  const newStatus = newPresence.status;

  if (oldStatus === newStatus) return;

  try {
    const channel = await newPresence.guild.channels.fetch(config.channelId).catch(() => null);
    if (!channel) return;

    const botUser = newPresence.user;
    const mentionContent = getMentionString(config.mentionRoleId, guildId);

    let embed = null;

    if (oldStatus === 'offline' && newStatus !== 'offline') {
      embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🤖 他Botオンライン検知')
        .setDescription(`**${botUser.tag}** がオンラインになりました。`)
        .setTimestamp();
    } else if (oldStatus !== 'offline' && newStatus === 'offline') {
      embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🤖 他Botオフライン検知')
        .setDescription(`**${botUser.tag}** がオフラインになりました。`)
        .setTimestamp();
    }

    if (embed) {
      await channel.send({
        content: mentionContent,
        embeds: [embed]
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Presence Update Error:', e);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'bot-monitor') {
    const status = interaction.options.getString('status');
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');

    const settings = client.getSettings();
    if (!settings[interaction.guildId]) settings[interaction.guildId] = {};

    if (status === 'on') {
      if (!channel) {
        return interaction.reply({
          content: '⚠️ ONにする場合は通知を送るチャンネルを指定してください。',
          flags: MessageFlags.Ephemeral
        });
      }

      settings[interaction.guildId].botMonitor = {
        enabled: true,
        channelId: channel.id,
        mentionRoleId: role ? role.id : null
      };
      await client.saveSettings(settings);

      return interaction.reply({
        content: `✅ 他Botのオンライン/オフライン監視通知を **ON** に設定しました。\n・送信先: ${channel}\n・メンション: ${role ? role : 'なし'}`,
        flags: MessageFlags.Ephemeral
      });
    } else {
      if (settings[interaction.guildId].botMonitor) {
        settings[interaction.guildId].botMonitor.enabled = false;
      }
      await client.saveSettings(settings);

      return interaction.reply({
        content: `❌ 他Botのオンライン/オフライン監視通知を **OFF** に設定しました。`,
        flags: MessageFlags.Ephemeral
      });
    }
  }

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`コマンド実行エラー [/${interaction.commandName}]:`, error);
  }
});

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Discord Bot is Online!'));
app.listen(PORT, () => console.log(`🌐 [Web Server] ポート ${PORT} で稼働中。`));

console.log('[Login] Discordへのログインを開始します...');
loadDataFromGitHub().then(() => {
  if (!TOKEN) {
    console.error('[Error] DISCORD_TOKEN が設定されていません！');
    return;
  }
  client.login(TOKEN).catch(err => {
    console.error('[Login Error] ログインに失敗しました:', err);
  });
});
