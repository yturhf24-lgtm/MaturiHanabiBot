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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

client.commands = new Collection();

const DATA_FILE = path.resolve(__dirname, 'data.json');
let localSettingsCache = {};

const notifiedQuakes = new Set();
const notifiedNews = new Set();
const notifiedEvacuations = new Set();

// -------------------------------------------------------------
// 📁 GitHub連携型 data.json 管理システム
// -------------------------------------------------------------
async function loadDataFromGitHub() {
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
      }
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

// -------------------------------------------------------------
// コマンドファイルの自動読み込み
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// 🌍 地震・津波情報の定期取得と配信（リアルタイム厳密チェック版）
// -------------------------------------------------------------
async function checkEarthquakeAndTsunami() {
  try {
    const res = await fetch('https://api.p2pquake.net/v2/history?codes=551&limit=5', {
      headers: { 'User-Agent': 'MaturiHanabiBot/1.0' }
    });
    if (!res.ok) return;

    const data = await res.json();
    if (!data || data.length === 0) return;

    data.reverse();

    for (const quake of data) {
      const quakeId = quake.id || quake.time;

      if (notifiedQuakes.has(quakeId)) continue;
      
      const quakeTime = new Date(quake.time || quake.earthquake?.time).getTime();
      
      // 発生から10分以内の新しい地震のみを処理
      if (Date.now() - quakeTime > 10 * 60 * 1000) {
        notifiedQuakes.add(quakeId);
        continue;
      }

      notifiedQuakes.add(quakeId);
      if (notifiedQuakes.size > 100) {
        const firstKey = notifiedQuakes.keys().next().value;
        notifiedQuakes.delete(firstKey);
      }

      const hypocenter = quake.earthquake?.hypocenter?.name || '不明';
      const magnitude = quake.earthquake?.hypocenter?.magnitude ?? '不明';
      const maxScale = quake.earthquake?.maxScale ?? 0;
      const domesticTsunami = quake.earthquake?.domesticTsunami || '不明';

      const scaleReadableMap = {
        10: '震度1', 20: '震度2', 30: '震度3', 40: '震度4',
        45: '震度5弱', 50: '震度5強', 55: '震度6弱', 60: '震度6強', 70: '震度7'
      };
      const scaleText = scaleReadableMap[maxScale] || '不明';
      const scaleValues = { '1': 10, '2': 20, '3': 30, '4': 40, '5lower': 45, '5upper': 50 };

      const settings = client.getSettings();
      for (const [guildId, guildSettings] of Object.entries(settings)) {
        // 1. 通常地震情報
        const eqConfig = guildSettings?.earthquakeInfo;
        if (eqConfig && eqConfig.enabled && eqConfig.channelId) {
          if (maxScale >= (scaleValues[eqConfig.minScale] || 0)) {
            try {
              const guild = await client.guilds.fetch(guildId).catch(() => null);
              if (guild) {
                const channel = await guild.channels.fetch(eqConfig.channelId).catch(() => null);
                if (channel) {
                  const embed = new EmbedBuilder()
                    .setColor(0xFF4500)
                    .setTitle('🌍 地震情報')
                    .addFields(
                      { name: '発生時刻', value: quake.time || '不明', inline: true },
                      { name: '震源地', value: hypocenter, inline: true },
                      { name: '最大震度', value: scaleText, inline: true },
                      { name: 'マグニチュード (M)', value: String(magnitude), inline: true }
                    )
                    .setTimestamp();
                  await channel.send({ content: eqConfig.mentionRoleId ? `<@&${eqConfig.mentionRoleId}>` : null, embeds: [embed] }).catch(() => {});
                }
              }
            } catch (e) {}
          }
        }

        // 2. 津波警報・注意報
        const tsunamiConfig = guildSettings?.tsunamiWarning;
        if (tsunamiConfig && tsunamiConfig.enabled && tsunamiConfig.channelId) {
          if (domesticTsunami === 'Warning' || domesticTsunami === 'Checking') {
            try {
              const guild = await client.guilds.fetch(guildId).catch(() => null);
              if (guild) {
                const channel = await guild.channels.fetch(tsunamiConfig.channelId).catch(() => null);
                if (channel) {
                  const embed = new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('🌊 津波警報・注意報発令')
                    .setDescription(domesticTsunami === 'Warning' ? '津波警報等が発表されています。沿岸部の方は直ちに高台へ避難してください！' : '津波の有無を確認中です。海岸付近には近づかないでください。')
                    .setTimestamp();
                  await channel.send({ content: tsunamiConfig.mentionRoleId ? `<@&${tsunamiConfig.mentionRoleId}>` : null, embeds: [embed] }).catch(() => {});
                }
              }
            } catch (e) {}
          }
        }
      }
    }
  } catch (err) {
    console.error('地震情報取得エラー:', err);
  }
}

// -------------------------------------------------------------
// 📰 ニュース速報・避難情報の定期取得と配信
// -------------------------------------------------------------
async function checkNewsAndEvacuations() {
  const settings = client.getSettings();
  try {
    const res = await fetch('https://news.yahoo.co.jp/rss/topics/top-picks.xml');
    if (res.ok) {}
  } catch (e) {}
}

// -------------------------------------------------------------
// Bot起動時の処理
// -------------------------------------------------------------
client.once('clientReady', async (c) => {
  console.log(`🟢 Bot ログイン完了: ${c.user.tag}`);

  setInterval(() => {
    const guildCount = client.guilds.cache.size;
    const ping = client.ws.ping;
    client.user.setActivity({
      name: `Ping ${ping}ms | ${guildCount} Servers`,
      type: 3
    });
  }, 10000);

  // 地震チェック (10秒ごと)
  setInterval(checkEarthquakeAndTsunami, 10000);
  setInterval(checkNewsAndEvacuations, 60000);

  const settings = client.getSettings();
  for (const [guildId, guildSettings] of Object.entries(settings)) {
    const notifyConfig = guildSettings?.restartNotify;
    if (!notifyConfig || !notifyConfig.enabled || !notifyConfig.channelId) continue;
    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) continue;
      const channel = await guild.channels.fetch(notifyConfig.channelId).catch(() => null);
      if (!channel) continue;
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🔄 システム再起動・アップデート完了')
        .setDescription('Botが正常に再起動しました。')
        .setTimestamp();
      await channel.send({ content: notifyConfig.mentionRoleId ? `<@&${notifyConfig.mentionRoleId}>` : null, embeds: [embed] }).catch(() => {});
    } catch (err) {}
  }
});

// コマンド実行
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`コマンド実行エラー [/${interaction.commandName}]:`, error);
    const errorEmbed = new EmbedBuilder().setColor(0xFF0000).setTitle('❌ 実行エラー').setDescription('エラーが発生しました。');
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }
  }
});

// 各種イベント監視
client.on('guildMemberAdd', async (member) => {
  const avatarCommand = client.commands.get('anti-default-avatar');
  if (avatarCommand && avatarCommand.handleMemberAdd) await avatarCommand.handleMemberAdd(member, client);
  const newAccCommand = client.commands.get('anti-new-account');
  if (newAccCommand && newAccCommand.handleMemberAdd) await newAccCommand.handleMemberAdd(member, client);
});

client.on('messageCreate', async (message) => {
  const antiSpamCmd = client.commands.get('anti-spam-message');
  if (antiSpamCmd && antiSpamCmd.handleMessage) await antiSpamCmd.handleMessage(message, client);
});

const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Discord Bot is Online!'));
app.listen(PORT, () => console.log(`🌐 [Web Server] ポート ${PORT} で稼働中。`));

loadDataFromGitHub().then(() => {
  client.login(TOKEN);
});
