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
const notifiedWeathers = new Set();
let isBotStarted = false; // 起動直後の過去データ一斉送信を防ぐフラグ

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
// 🌍 地震・津波情報の定期取得と配信（詳細テキスト＆画像付き）
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
      
      if (!isBotStarted) {
        notifiedQuakes.add(quakeId);
        continue;
      }

      if (Date.now() - quakeTime > 10 * 60 * 1000) {
        notifiedQuakes.add(quakeId);
        continue;
      }

      notifiedQuakes.add(quakeId);
      if (notifiedQuakes.size > 100) {
        const firstKey = notifiedQuakes.keys().next().value;
        notifiedQuakes.delete(firstKey);
      }

      const eqData = quake.earthquake || {};
      const hypocenter = eqData.hypocenter?.name || '不明';
      const magnitude = eqData.hypocenter?.magnitude ?? '不明';
      const depth = eqData.hypocenter?.depth ?? '不明';
      const maxScale = eqData.maxScale ?? 0;
      const domesticTsunami = eqData.domesticTsunami || '不明';

      const scaleReadableMap = {
        10: '震度1', 20: '震度2', 30: '震度3', 40: '震度4',
        45: '震度5弱', 50: '震度5強', 55: '震度6弱', 60: '震度6強', 70: '震度7'
      };
      const scaleText = scaleReadableMap[maxScale] || '不明';
      const scaleValues = { '1': 10, '2': 20, '3': 30, '4': 40, '5lower': 45, '5upper': 50 };

      let tsunamiText = 'この地震による津波の心配はありません。';
      if (domesticTsunami === 'Warning') tsunamiText = '⚠️ この地震により津波警報等が発表されています！';
      else if (domesticTsunami === 'Checking') tsunamiText = '🔍 この地震による津波の有無を確認中です。';
      else if (domesticTsunami === 'NotAvailable') tsunamiText = '津波に関する情報は不明です。';

      let areasDescription = '';
      if (eqData.points && Array.isArray(eqData.points)) {
        const scaleGroups = {};
        for (const pt of eqData.points) {
          const s = pt.scale;
          if (!scaleGroups[s]) scaleGroups[s] = [];
          scaleGroups[s].push(pt.addr);
        }

        const sortedScales = Object.keys(scaleGroups).sort((a, b) => b - a);
        const descParts = [];

        for (const s of sortedScales) {
          const sText = scaleReadableMap[s] || `震度?`;
          const addrs = scaleGroups[s];
          let addrStr = '';
          if (addrs.length <= 15) {
            addrStr = addrs.join('、');
          } else {
            addrStr = addrs.slice(0, 15).join('、') + `、ほか${addrs.length - 15}地域`;
          }
          descParts.push(`また、${sText}を\n${addrStr}\nで観測しています。`);
        }
        areasDescription = descParts.join('\n\n');
      }

      const mainDescription = `さきほど、**最大${scaleText}**を観測する地震がありました。\n` +
        `${tsunamiText}\n` +
        `震源地は**${hypocenter}**、震源の深さは**${depth}km**、地震の規模を示すマグニチュードは**${magnitude}**と推定されています。\n\n` +
        (areasDescription ? `この地震で${scaleText}を\n` + (eqData.points ? eqData.points.filter(p => p.scale === maxScale).map(p => p.addr).join('、') : '') + `\nで観測しました。\n\n${areasDescription}` : '');

      const settings = client.getSettings();
      for (const [guildId, guildSettings] of Object.entries(settings)) {
        const eqConfig = guildSettings?.earthquakeInfo;
        if (eqConfig && eqConfig.enabled && eqConfig.channelId) {
          if (maxScale >= (scaleValues[eqConfig.minScale] || 0)) {
            try {
              const guild = await client.guilds.fetch(guildId).catch(() => null);
              if (guild) {
                const channel = await guild.channels.fetch(eqConfig.channelId).catch(() => null);
                if (channel) {
                  const embed = new EmbedBuilder()
                    .setColor(maxScale >= 40 ? 0xFF0000 : 0xFF8C00)
                    .setTitle('地震情報')
                    .setDescription(mainDescription)
                    .setImage('https://www.jma.go.jp/bosai/forecast/img/kaikyo.png')
                    .setTimestamp();

                  await channel.send({ content: eqConfig.mentionRoleId ? `<@&${eqConfig.mentionRoleId}>` : null, embeds: [embed] }).catch(() => {});
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
// ☀️ 天気予報の定期チェックと配信
// -------------------------------------------------------------
async function checkWeatherForecasts() {
  if (!isBotStarted) return;
  try {
    const settings = client.getSettings();
    for (const [guildId, guildSettings] of Object.entries(settings)) {
      const weatherConfig = guildSettings?.weatherForecast;
      if (weatherConfig && weatherConfig.enabled && weatherConfig.channelId) {
        const todayStr = new Date().toDateString();
        const checkKey = `${guildId}-${todayStr}`;
        if (notifiedWeathers.has(checkKey)) continue;

        try {
          const guild = await client.guilds.fetch(guildId).catch(() => null);
          if (!guild) continue;
          const channel = await guild.channels.fetch(weatherConfig.channelId).catch(() => null);
          if (!channel) continue;

          const region = weatherConfig.region || '全国';
          const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`☀️ ${region}の天気予報`)
            .setDescription(`設定されている対象地域（**${region}**）の最新の天気予報をお届けします。`)
            .setTimestamp();

          if (weatherConfig.sendImage) {
            embed.setImage('https://www.jma.go.jp/bosai/forecast/img/aperiodic/f_himawari.jpg');
          }

          await channel.send({ content: weatherConfig.mentionRoleId ? `<@&${weatherConfig.mentionRoleId}>` : null, embeds: [embed] }).catch(() => {});
          notifiedWeathers.add(checkKey);
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('天気予報取得エラー:', err);
  }
}

// -------------------------------------------------------------
// 🚨 避難情報の定期チェックと配信
// -------------------------------------------------------------
async function checkEvacuations() {
  if (!isBotStarted) return;
  try {
    // 避難情報の取得処理枠
  } catch (err) {
    console.error('避難情報取得エラー:', err);
  }
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

  setTimeout(() => {
    isBotStarted = true;
    console.log('[Bot Monitor] 起動シーケンス完了。リアルタイム監視を開始します。');
  }, 5000);

  setInterval(checkEarthquakeAndTsunami, 10000); // 地震: 10秒ごと
  setInterval(checkWeatherForecasts, 60 * 60 * 1000); // 天気: 1時間ごと
  setInterval(checkEvacuations, 30000); // 避難情報: 30秒ごと

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
