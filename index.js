const fs = require('fs');
const path = require('path');
const express = require('express');
const { Client, GatewayIntentBits, Collection, MessageFlags, EmbedBuilder } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.DISCORD_TOKEN;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // GitHubのアクセストークン
const REPO_OWNER = 'yturhf24-lgtm'; // あなたのGitHubユーザー名
const REPO_NAME = 'MaturiHanabiBot'; // リポジトリ名
const BRANCH = 'main'; // ブランチ名

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

// 重複通知防止用のキャッシュ（地震ID等を保存）
const notifiedQuakes = new Set();

// -------------------------------------------------------------
// 📁 GitHub連携型 data.json 管理システム（個別サーバー対応）
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
    console.error('[Data Load Warning] GitHubからの読み込みに失敗しました。ローカルファイルを使用します:', e);
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
// 🌍 地震・津波情報の定期取得と配信チェック機能
// -------------------------------------------------------------
async function checkEarthquakeAndTsunami() {
  try {
    // P2P地震情報 API (コード 551: 地震情報)
    const res = await fetch('https://api.p2pquake.net/v2/history?codes=551&limit=1', {
      headers: { 'User-Agent': 'MaturiHanabiBot/1.0' }
    });
    if (!res.ok) return;

    const data = await res.json();
    if (!data || data.length === 0) return;

    const quake = data[0];
    const quakeId = quake.id || quake.time;

    // 既に通知済みの地震であればスキップ
    if (notifiedQuakes.has(quakeId)) return;
    
    // 初回起動時の大量過去通知を防ぐため、古いもの（5分以上前）は登録してスルー
    const quakeTime = new Date(quake.time || quake.earthquake?.time).getTime();
    if (Date.now() - quakeTime > 5 * 60 * 1000) {
      notifiedQuakes.add(quakeId);
      return;
    }

    notifiedQuakes.add(quakeId);
    if (notifiedQuakes.size > 100) {
      const firstKey = notifiedQuakes.keys().next().value;
      notifiedQuakes.delete(firstKey);
    }

    // 地震データの詳細解析
    const hypocenter = quake.earthquake?.hypocenter?.name || '不明';
    const magnitude = quake.earthquake?.hypocenter?.magnitude ?? '不明';
    const maxScale = quake.earthquake?.maxScale ?? 0; // 例: 10=震度1, 30=震度3, 40=震度4, 50=震度5弱...
    const domesticTsunami = quake.earthquake?.domesticTsunami || '不明';

    // 震度数値の変換マップ
    const scaleMap = {
      10: '1', 20: '2', 30: '3', 40: '4',
      45: '5lower', 50: '5upper', 55: '6lower', 60: '6upper', 70: '7'
    };
    const scaleReadableMap = {
      10: '震度1', 20: '震度2', 30: '震度3', 40: '震度4',
      45: '震度5弱', 50: '震度5強', 55: '震度6弱', 60: '震度6強', 70: '震度7'
    };
    const currentScaleStr = scaleMap[maxScale] || '0';
    const scaleText = scaleReadableMap[maxScale] || '不明';

    // 各サーバーの設定を確認して配信
    const settings = client.getSettings();
    for (const [guildId, guildSettings] of Object.entries(settings)) {
      const eqConfig = guildSettings?.earthquakeInfo;
      if (!eqConfig || !eqConfig.enabled || !eqConfig.channelId) continue;

      // 最低震度の判定処理
      const minScaleSetting = eqConfig.minScale; // '1', '2', '3', '4', '5lower', '5upper' など
      const scaleValues = { '1': 10, '2': 20, '3': 30, '4': 40, '5lower': 45, '5upper': 50 };
      if (maxScale < (scaleValues[minScaleSetting] || 0)) continue;

      try {
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) continue;
        const channel = await guild.channels.fetch(eqConfig.channelId).catch(() => null);
        if (!channel) continue;

        let mentionText = eqConfig.mentionRoleId ? `<@&${eqConfig.mentionRoleId}>` : '';

        const embed = new EmbedBuilder()
          .setColor(0xFF4500)
          .setTitle('🌍 地震情報')
          .addFields(
            { name: '発生時刻', value: quake.time || '不明', inline: true },
            { name: '震源地', value: hypocenter, inline: true },
            { name: '最大震度', value: scaleText, inline: true },
            { name: 'マグニチュード (M)', value: String(magnitude), inline: true },
            { name: '津波情報', value: getTsunamiText(domesticTsunami), inline: false }
          )
          .setTimestamp();

        // 画像送信が有効な場合、イメージ（例としてダミーあるいはAPIのマップ画像構造）を添付対応
        let files = [];
        // P2P地震情報等は詳細情報に画像が含まれない場合があるため、Embed主体で構成しつつ必要に応じ対応

        await channel.send({
          content: mentionText || null,
          embeds: [embed]
        }).catch(() => {});

      } catch (err) {
        console.error(`サーバー ${guildId} への地震情報送信エラー:`, err);
      }
    }

  } catch (err) {
    console.error('地震情報API取得エラー:', err);
  }
}

function getTsunamiText(code) {
  switch (code) {
    case 'None': return 'この地震による津波の心配はありません。';
    case 'Checking': return '津波有無を確認中です。';
    case 'Warning': return '津波警報等が発表されています！';
    default: return '津波情報なし';
  }
}

// -------------------------------------------------------------
// Bot起動時の処理 ＆ ステータス定期更新・再起動通知・地震監視開始
// -------------------------------------------------------------
client.once('clientReady', async (c) => {
  console.log(`🟢 Bot ログイン完了: ${c.user.tag}`);

  // 「視聴中」ステータスにサーバー数とPingを定期反映（10秒ごと）
  setInterval(() => {
    const guildCount = client.guilds.cache.size;
    const ping = client.ws.ping;
    
    client.user.setActivity({
      name: `Ping ${ping}ms | ${guildCount} Servers`,
      type: 3 // 3 = Watching (視聴中)
    });
  }, 10000);

  // 地震情報の定期ポーリング（30秒ごと）
  setInterval(checkEarthquakeAndTsunami, 30000);

  // 再起動通知の送信
  const settings = client.getSettings();
  for (const [guildId, guildSettings] of Object.entries(settings)) {
    const notifyConfig = guildSettings?.restartNotify;
    if (!notifyConfig || !notifyConfig.enabled || !notifyConfig.channelId) continue;

    try {
      const guild = await client.guilds.fetch(guildId).catch(() => null);
      if (!guild) continue;

      const channel = await guild.channels.fetch(notifyConfig.channelId).catch(() => null);
      if (!channel) continue;

      let mentionText = '';
      if (notifyConfig.mentionRoleId) mentionText = `<@&${notifyConfig.mentionRoleId}>`;

      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🔄 システム再起動・アップデート完了')
        .setDescription('Botのアップデートやシステムメンテナンスに伴う再起動・アップデートが行われました。正常に稼働を再開しています。')
        .setTimestamp();

      await channel.send({
        content: mentionText ? mentionText : null,
        embeds: [embed]
      }).catch(() => {});

    } catch (err) {
      console.error(`サーバー ${guildId} への再起動通知送信エラー:`, err);
    }
  }
});

// スラッシュコマンドの実行処理
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`コマンド実行エラー [/${interaction.commandName}]:`, error);
    const errorEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('❌ 実行エラー')
      .setDescription('コマンドの実行中にエラーが発生しました。');

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
    } else {
      await interaction.reply({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] }).catch(() => null);
    }
  }
});

// -------------------------------------------------------------
// イベント監視（各種対策）
// -------------------------------------------------------------
client.on('guildMemberAdd', async (member) => {
  const avatarCommand = client.commands.get('anti-default-avatar');
  if (avatarCommand && avatarCommand.handleMemberAdd) {
    await avatarCommand.handleMemberAdd(member, client);
  }

  const newAccCommand = client.commands.get('anti-new-account');
  if (newAccCommand && newAccCommand.handleMemberAdd) {
    await newAccCommand.handleMemberAdd(member, client);
  }
});

client.on('messageCreate', async (message) => {
  const antiSpamCmd = client.commands.get('anti-spam-message');
  if (antiSpamCmd && antiSpamCmd.handleMessage) {
    await antiSpamCmd.handleMessage(message, client);
  }
});

// Render Web Service用サーバー
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Discord Bot is Online!');
});

app.listen(PORT, () => {
  console.log(`🌐 [Web Server] ポート ${PORT} で稼働中。`);
});

// 起動時にデータをロードしてからログイン
loadDataFromGitHub().then(() => {
  client.login(TOKEN);
});
