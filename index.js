const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Collection, MessageFlags, EmbedBuilder, AttachmentBuilder } = require('discord.js');
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
let isBotStarted = false;

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

// メンション文字列を安全に生成するヘルパー関数（@@everyoneバグ対策済み）
function getMentionString(roleId, guildId) {
  if (!roleId) return null;
  if (roleId === 'everyone' || roleId === '@everyone' || roleId === guildId) {
    return '@everyone';
  }
  return `<@&${roleId}>`;
}

// -------------------------------------------------------------
// 🌍 地震・津波情報の定期取得（安定した画像添付付き）
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
      const quakeTime = new Date(quake.time || quake.earthquake?.time).getTime();
      
      if (!isBotStarted) {
        notifiedQuakes.add(quakeId);
        continue;
      }

      if (notifiedQuakes.has(quakeId)) continue;

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
      const rawTimeString = quake.time || eqData.time || '';

      const scaleReadableMap = {
        10: '震度1', 20: '震度2', 30: '震度3', 40: '震度4',
        45: '震度5弱', 50: '震度5強', 55: '震度6弱', 60: '震度6強', 70: '震度7'
      };
      const scaleText = scaleReadableMap[maxScale] || '不明';
      const scaleValues = { '1': 10, '2': 20, '3': 30, '4': 40, '5lower': 45, '5upper': 50 };

      let formattedTime = '日時不明';
      if (rawTimeString) {
        const d = new Date(rawTimeString);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = d.getMonth() + 1;
          const day = d.getDate();
          const hours = String(d.getHours()).padStart(2, '0');
          const minutes = String(d.getMinutes()).padStart(2, '0');
          formattedTime = `${year}年${month}月${day}日 ${hours}:${minutes}頃`;
        }
      }

      let tsunamiText = 'この地震による津波の心配はありません。';
      if (domesticTsunami === 'Warning') tsunamiText = '⚠️ この地震により津波警報等が発表されています！';
      else if (domesticTsunami === 'Checking') tsunamiText = '🔍 この地震による津波の有無を確認中です。';
      else if (domesticTsunami === 'NotAvailable') tsunamiText = '津波に関する情報は不明です。';

      let areaDetailsText = '';
      if (eqData.points && Array.isArray(eqData.points)) {
        const scaleGroups = {};
        for (const pt of eqData.points) {
          const s = pt.scale;
          if (!scaleGroups[s]) scaleGroups[s] = [];
          scaleGroups[s].push(pt.addr);
        }

        const sortedScales = Object.keys(scaleGroups).sort((a, b) => b - a);
        const lines = [];
        for (const s of sortedScales) {
          const sText = scaleReadableMap[s] || `震度?`;
          const addrs = scaleGroups[s];
          let addrStr = addrs.slice(0, 10).join('、');
          if (addrs.length > 10) {
            addrStr += ` ほか${addrs.length - 10}市区町村`;
          }
          lines.push(`**${sText}**: ${addrStr}`);
        }
        areaDetailsText = lines.join('\n');
      }

      const settings = client.getSettings();
      const sortedEntries = Object.entries(settings);

      for (const [guildId, guildSettings] of sortedEntries) {
        const eqConfig = guildSettings?.earthquakeInfo;
        if (eqConfig && eqConfig.enabled && eqConfig.channelId) {
          if (maxScale >= (scaleValues[eqConfig.minScale] || 0)) {
            try {
              const guild = await client.guilds.fetch(guildId).catch(() => null);
              if (guild) {
                const channel = await guild.channels.fetch(eqConfig.channelId).catch(() => null);
                if (channel) {
                  const embed = new EmbedBuilder()
                    .setColor(maxScale >= 40 ? 0xFF0000 : (maxScale >= 30 ? 0xFF8C00 : 0x0099FF))
                    .setTitle('🚨 地震情報')
                    .setDescription(`${formattedTime}頃、地震が発生しました。`)
                    .addFields(
                      { name: '📍 震央', value: hypocenter, inline: true },
                      { name: '📏 深さ', value: depth === '不明' ? '不明' : `${depth}km`, inline: true },
                      { name: 'マグニチュード', value: String(magnitude), inline: true },
                      { name: '🔴 最大震度', value: scaleText, inline: false },
                      { name: '🌊 津波情報', value: tsunamiText, inline: false }
                    );

                  if (areaDetailsText) {
                    embed.addFields({ name: '📊 各地の震度詳細', value: areaDetailsText, inline: false });
                  }

                  embed.setTimestamp();

                  // 地図画像を添付して表示をリッチにする
                  let files = [];
                  try {
                    // 気象庁の現在有効な公開お天気・地図プレビュー画像を動的に取得・添付
                    const imgRes = await fetch('https://www.jma.go.jp/bosai/forecast/img/aperiodic/f_himawari.jpg');
                    if (imgRes.ok) {
                      const arrayBuffer = await imgRes.arrayBuffer();
                      const buffer = Buffer.from(arrayBuffer);
                      const attachment = new AttachmentBuilder(buffer, { name: 'earthquake_map.jpg' });
                      embed.setImage('attachment://earthquake_map.jpg');
                      files.push(attachment);
                    }
                  } catch (imgErr) {
                    // 画像取得に失敗してもテキスト通知は継続する
                  }

                  const mentionContent = getMentionString(eqConfig.mentionRoleId, guildId);

                  await channel.send({ 
                    content: mentionContent, 
                    embeds: [embed],
                    files: files
                  }).catch(() => {});

                  await new Promise(resolve => setTimeout(resolve, 500));
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
// ☀️ 天気予報の定期チェック
// -------------------------------------------------------------
async function checkWeatherForecasts() {
  if (!isBotStarted) return;
  try {
    const settings = client.getSettings();
    for (const [guildId, guildSettings] of Object.entries(settings)) {
      const weatherConfig = guildSettings?.weatherForecast;
      if (weatherConfig && weatherConfig.enabled && weatherConfig.channelId) {
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

          let files = [];
          try {
            const imgRes = await fetch('https://www.jma.go.jp/bosai/forecast/img/aperiodic/f_himawari.jpg');
            if (imgRes.ok) {
              const arrayBuffer = await imgRes.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const attachment = new AttachmentBuilder(buffer, { name: 'weather.jpg' });
              embed.setImage('attachment://weather.jpg');
              files.push(attachment);
            }
          } catch (e) {}

          const mentionContent = getMentionString(weatherConfig.mentionRoleId, guildId);

          await channel.send({ 
            content: mentionContent, 
            embeds: [embed],
            files: files
          }).catch(() => {});

          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('天気予報取得エラー:', err);
  }
}

async function checkEvacuations() {
  if (!isBotStarted) return;
}

async function checkNews() {
  if (!isBotStarted) return;
}

// -------------------------------------------------------------
// Bot起動時の処理
// -------------------------------------------------------------
client.once('clientReady', async (c) => {
  console.log(`🟢 Bot ログイン完了: ${c.user.tag}`);

  let statusToggle = false;
  setInterval(() => {
    const guildCount = client.guilds.cache.size;
    let totalMembers = 0;
    client.guilds.cache.forEach(guild => {
      totalMembers += guild.memberCount || 0;
    });

    if (statusToggle) {
      client.user.setActivity({ name: `導入プレイヤー数: ${totalMembers}人`, type: 3 });
    } else {
      client.user.setActivity({ name: `Ping ${client.ws.ping}ms | ${guildCount} Servers`, type: 3 });
    }
    statusToggle = !statusToggle;
  }, 10000);

  setTimeout(() => {
    isBotStarted = true;
    console.log('[Bot Monitor] 起動シーケンス完了。リアルタイム監視を稼働します。');
  }, 8000);

  setInterval(checkEarthquakeAndTsunami, 15000);
  setInterval(checkWeatherForecasts, 60 * 60 * 1000);
  setInterval(checkEvacuations, 60 * 1000);
  setInterval(checkNews, 60 * 1000);

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

      const mentionContent = getMentionString(notifyConfig.mentionRoleId, guildId);

      await channel.send({ content: mentionContent, embeds: [embed] }).catch(() => {});
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
