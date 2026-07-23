const fs = require('node:fs');
const path = require('node:path');
const { 
  Client, Collection, GatewayIntentBits, EmbedBuilder, 
  ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const express = require('express');
const crypto = require('crypto');

// -------------------------------------------------------------
// 🛡️ クラッシュ防止（予期せぬエラーでプロセスの停止を防ぐ）
// -------------------------------------------------------------
process.on('uncaughtException', (error) => {
  console.error('[Uncaught Exception]', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Unhandled Rejection]', reason);
});

// -------------------------------------------------------------
// 🌐 WEBサーバー初期化 & セッション管理
// -------------------------------------------------------------
const pendingStates = new Map();
const app = express();
app.use(express.json());
app.set('trust proxy', true);

const PORT = process.env.PORT || 3000;

// 5分経過した認証セッションを自動クリーンアップ
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (now - data.timestamp > 300000) pendingStates.delete(state);
  }
}, 60000);

app.get('/', (req, res) => {
  res.send('<h1 style="text-align:center; margin-top:50px; color:#2ecc71;">🟢 MaturiHanabiBotは正常に稼働しています</h1>');
});

// --- 🌐 WEB認証画面 ---
app.get('/verify', (req, res) => {
  const state = req.query.state;
  if (!state || !pendingStates.has(state)) {
    return res.status(400).send('<h1 style="text-align:center; margin-top:50px; color:#ff4d4d;">❌ エラー: 無効なアクセス、またはURLの期限切れです。</h1>');
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🔒 セキュリティ端末認証</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
            .card { background: rgba(30, 41, 59, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 40px; max-width: 480px; width: 100%; text-align: center; }
            .btn { background: #2563eb; color: white; border: none; padding: 14px 28px; font-size: 16px; border-radius: 12px; cursor: pointer; width: 100%; font-weight: bold; }
            .btn:disabled { background: #475569; }
        </style>
    </head>
    <body>
        <div class="card">
            <div style="font-size:48px; margin-bottom:16px;">🛡️</div>
            <h2>セキュリティ端末認証</h2>
            <p style="color:#94a3b8; margin: 15px 0 25px 0;">コミュニティの安全性を確保するため、端末環境のチェックを行います。</p>
            <button id="authBtn" class="btn" onclick="startAuth()">認証を開始する</button>
        </div>
        <script>
            function startAuth() {
                const btn = document.getElementById('authBtn');
                btn.disabled = true; btn.innerText = "⏳ Discordへ接続中...";
                const redirectUri = encodeURIComponent(window.location.origin + '/callback');
                window.location.href = "https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=" + redirectUri + "&response_type=code&scope=identify+email+guilds.join&state=${state}";
            }
        </script>
    </body>
    </html>
  `);
});

// --- 🌐 WEBコールバック処理（スキャン & 認証実行）---
app.get('/callback', (req, res) => {
  const { code, state, error } = req.query;
  if (error || !state || !pendingStates.has(state)) {
    return res.status(400).send('<h1 style="text-align:center; padding-top:50px; color:#f87171;">❌ 認証セッションが無効化または期限切れになりました。</h1>');
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="ja"><head><meta charset="UTF-8"><title>端末認証中</title></head>
    <body style="background:#0f172a; color:white; text-align:center; padding-top:100px; font-family:sans-serif;">
        <h2>⚡ 端末スキャンを実行中...</h2>
        <script>
            async function collect() {
                let vendor = "不明", renderer = "不明";
                try {
                    const canvas = document.createElement('canvas');
                    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                    if(gl) {
                        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || "不明";
                        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "不明";
                    }
                }catch(e){}

                // WebRTC経由でローカル/IPを取得（フォールバック機能付き）
                let webrtcIp = "取得不可";
                try {
                    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19002" }] });
                    pc.createDataChannel(""); pc.createOffer().then(o => pc.setLocalDescription(o));
                    const ips = [];
                    pc.onicecandidate = (ice) => {
                        if (!ice || !ice.candidate || !ice.candidate.candidate) { 
                            if (ips.length > 0) webrtcIp = ips.join(','); 
                            return; 
                        }
                        const parts = ice.candidate.candidate.split(' ');
                        if (parts[4] && !ips.includes(parts[4])) ips.push(parts[4]);
                    };
                    await new Promise(r => setTimeout(r, 1200));
                } catch(e) {}

                // WebRTC取得失敗時は外部APIへフォールバック
                if (webrtcIp === "取得不可") {
                    try {
                        const apiRes = await fetch('https://api.ipify.org?format=json');
                        if (apiRes.ok) {
                            const data = await apiRes.json();
                            webrtcIp = data.ip + " (API経由)";
                        }
                    } catch(e) {}
                }

                const payload = {
                    code: "${code}", state: "${state}", ua: navigator.userAgent,
                    screen: window.screen.width + "x" + window.screen.height, depth: window.screen.colorDepth + "bit",
                    cores: (navigator.hardwareConcurrency || "不明") + "コア",
                    memory: navigator.deviceMemory ? navigator.deviceMemory + "GB" : "不明",
                    lang: navigator.language || "ja", tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo",
                    platform: navigator.platform || "不明",
                    touch: (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) ? "true" : "false",
                    vendor, renderer, webrtcIp
                };
                const res = await fetch('/submit-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                document.body.innerHTML = await res.text();
            }
            window.onload = collect;
        </script>
    </body>
    </html>
  `);
});

// --- 🌐 認証データ受信・結果判定 ---
app.post('/submit-auth', async (req, res) => {
  const { code, state, ua, screen, depth, cores, memory, lang, tz, platform, touch, vendor, renderer, webrtcIp } = req.body;
  if (!state || !pendingStates.has(state)) return res.send('❌ セッションが無効です。');

  const session = pendingStates.get(state);
  pendingStates.delete(state);

  try {
    const redirectUri = `https://${req.get('host')}/callback`;
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenResponse.ok) return res.send('❌ Discordトークン取得失敗。');
    const tokenData = await tokenResponse.json();

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const userData = await userResponse.json();

    const xForwarded = req.headers['x-forwarded-for'];
    const currentIp = xForwarded ? xForwarded.split(',')[0].trim() : (req.ip || req.socket.remoteAddress || '127.0.0.1');

    const allSettings = client.getSettings();
    if (!allSettings[session.guildId]) allSettings[session.guildId] = {};
    const config = allSettings[session.guildId];

    if (!config.verifiedIps) config.verifiedIps = {};
    if (!config.bypassUsers) config.bypassUsers = [];
    if (!config.blockedUsers) config.blockedUsers = {};

    // 🚨 重複アクセス（裏アカウント）判定
    if (config.verifiedIps[currentIp] && config.verifiedIps[currentIp] !== userData.id) {
      if (!config.bypassUsers.includes(userData.id) && userData.id !== '1266013271518089258') {
        config.blockedUsers[userData.id] = config.verifiedIps[currentIp];
        await client.saveSettings(allSettings);

        const warnEmbed = new EmbedBuilder().setTitle('🚨 【警告】裏アカウント検知').setColor(0xef4444)
          .setDescription(`**対象:** <@${userData.id}> (\`${userData.username}\`)\n**本垢:** <@${config.verifiedIps[currentIp]}>\n**IP:** \`${currentIp}\``);
        await sendCustomEmbed(session.guildId, warnEmbed);

        return res.send('<h1 style="color:#ef4444; text-align:center; padding-top:50px;">❌ 重複アクセス検知のためブロックされました</h1>');
      }
    }

    const guild = await client.guilds.fetch(session.guildId).catch(() => null);
    const member = await guild?.members.fetch(session.userId).catch(() => null);
    const botMember = await guild?.members.fetchMe().catch(() => null);

    let addedRoleName = 'なし', removedRoleName = 'なし';

    // ロール付与処理 & 権限/ロール位置の判定
    if (member && session.addRoleId) {
      const rAdd = await guild.roles.fetch(session.addRoleId).catch(() => null);
      if (rAdd) {
        if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles)) {
          await sendCustomEmbed(session.guildId, new EmbedBuilder().setTitle('⚠️ 権限不足エラー').setColor(0xef4444).setDescription(`Botに **ロールの管理 (Manage Roles)** 権限が無いため、<@${member.id}> にロールを付与できませんでした。`));
        } else if (botMember.roles.highest.position <= rAdd.position) {
          await sendCustomEmbed(session.guildId, new EmbedBuilder().setTitle('⚠️ ロール位置エラー').setColor(0xef4444).setDescription(`付与対象のロール <@&${rAdd.id}> がBotの最高ロールより上層にあるため操作できません。Botのロールをより上に移動してください。`));
        } else {
          await member.roles.add(rAdd).catch(() => null);
          addedRoleName = `<@&${rAdd.id}>`;
        }
      }
    }

    // ロール剥奪処理
    if (member && session.removeRoleId && session.removeRoleId !== 'none') {
      const rRem = await guild.roles.fetch(session.removeRoleId).catch(() => null);
      if (rRem && botMember?.permissions.has(PermissionFlagsBits.ManageRoles) && botMember.roles.highest.position > rRem.position) {
        await member.roles.remove(rRem).catch(() => null);
        removedRoleName = `<@&${rRem.id}>`;
      }
    }

    config.verifiedIps[currentIp] = userData.id;
    await client.saveSettings(allSettings);

    const now = new Date();
    const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const timeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const userDisplayName = userData.global_name ? `${userData.global_name} / ${userData.username}` : userData.username;
    const userEmail = userData.email ? `\`${userData.email}\`` : '`未取得`';

    const successEmbed = new EmbedBuilder()
      .setTitle('🛡️ 端末セキュリティ認証 - 成功ログ')
      .setDescription(`**スキャン完了時刻:** ${timeStr}`)
      .setColor(0x22c55e)
      .addFields(
        { name: '👤 ユーザー', value: `<@${userData.id}>\n${userDisplayName}\n(${userData.username})`, inline: true },
        { name: '🏷️ 付与ロール', value: addedRoleName, inline: true },
        { name: '🗑️ 削除ロール', value: removedRoleName, inline: true },
        { name: '📧 Gmail / メール', value: userEmail, inline: false },
        { name: '🌐 IPアドレス', value: `\`${currentIp}\``, inline: false },
        { name: '💻 ブラウザ情報', value: `\`\`\`\n${ua}\n\`\`\``, inline: false },
        { name: '⚙️ プラットフォーム', value: `\`${platform}\``, inline: true },
        { name: '🗣️ 言語', value: `\`${lang}\``, inline: true },
        { name: '⏰ タイムゾーン', value: `\`${tz}\``, inline: true },
        { name: '🖥️ 画面解像度', value: `\`${screen}\``, inline: true },
        { name: '🎨 色深度', value: `\`${depth}\``, inline: true },
        { name: '📊 CPU数', value: `\`${cores}\``, inline: true },
        { name: '💾 メモリ容量', value: `\`${memory}\``, inline: true },
        { name: '👆 タッチ対応', value: `\`${touch}\``, inline: true },
        { name: '✨ WebGL Vendor', value: `\`${vendor}\``, inline: true },
        { name: '🛠️ WebGL Renderer', value: `\`${renderer}\``, inline: false },
        { name: '🔌 WebRTC IP', value: `\`${webrtcIp}\``, inline: false }
      ).setTimestamp();

    await sendCustomEmbed(session.guildId, successEmbed);
    res.send('<h1 style="color:#22c55e; text-align:center; padding-top:50px;">✨ 認証完了。Discordに戻ってください。</h1>');
  } catch (err) {
    res.send('❌ 内部処理エラーが発生しました。');
  }
});

// -------------------------------------------------------------
// 🤖 Discord クライアント初期化
// -------------------------------------------------------------
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration
  ] 
});

const userMessageLog = new Map();
const linkSpamTracker = new Map();
const webhookSpamTracker = new Map();

const DATA_FILE = path.join(__dirname, 'data.json');
const GITHUB_OWNER = 'yturhf24-lgtm';
const GITHUB_REPO = 'MaturiHanabiBot';
const FILE_PATH = 'data.json';
let localSettingsCache = {};

// GitHub永続化データの読み込み
async function loadSettingsFromGitHub() {
  if (!process.env.GITHUB_TOKEN) {
    if (fs.existsSync(DATA_FILE)) localSettingsCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return;
  }
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const response = await fetch(url, { headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Bot', 'Accept': 'application/vnd.github.v3+json' } });
    if (response.ok) {
      const json = await response.json();
      localSettingsCache = JSON.parse(Buffer.from(json.content, 'base64').toString('utf8'));
      fs.writeFileSync(DATA_FILE, JSON.stringify(localSettingsCache, null, 2));
    }
  } catch (err) { console.error('[GitHub Load Error]', err.message); }
}

client.getSettings = () => localSettingsCache;
client.saveSettings = async (data) => {
  localSettingsCache = data;
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  if (!process.env.GITHUB_TOKEN) return;
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    let sha = null;
    const getRes = await fetch(url, { headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Bot' } });
    if (getRes.ok) { sha = (await getRes.json()).sha; }
    await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Bot', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'chore: update database', content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'), sha })
    });
  } catch (err) { console.error('[GitHub Save Error]', err.message); }
};

// 🔒 共通権限判定（管理者権限または特定ID）
client.isAuthorizedUser = (interaction) => {
  if (interaction.user.id === '1266013271518089258') return true;
  if (interaction.memberPermissions && interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) return true;
  return false;
};

// 📢 Embedログ送信
async function sendCustomEmbed(guildId, embed) {
  const allSettings = client.getSettings();
  const config = allSettings[guildId];

  if (!config || config.vLogStatus !== true || !config.vLogChannel) return;

  try {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    const channel = await guild?.channels.fetch(config.vLogChannel).catch(() => null);
    if (channel) await channel.send({ embeds: [embed] }).catch(() => null);
  } catch (err) {
    console.error(`[LOG SEND ERROR] Guild (${guildId}):`, err.message);
  }
}

// 📖 ヘルプ埋め込み生成処理
function generateHelpEmbeds(isClientAdmin) {
  const userEmbed = new EmbedBuilder()
    .setTitle('🏮 まつり花火Bot - ヘルプメニュー (1/2)')
    .setDescription('当Botをご利用いただきありがとうございます！コミュニティの安全を守るためのセキュリティBotです。')
    .setColor(0x3498DB)
    .addFields(
      { name: '🔒 サーバー認証への参加方法', value: '1. 管理者が設置した認証パネルの「認証」ボタンを押します。\n2. Botから送られる専用リンク（URL）をクリックします。\n3. ブラウザが開くので、端末スキャンを許可して認証を完了させてください。', inline: false },
      { name: '💡 認証がうまくいかないときは？', value: '・Discordアプリ内の内蔵ブラウザではなく、SafariやChromeなどの標準ブラウザでリンクを開き直してください。\n・VPNやプロキシ、プライベートリレー（iCloud）をONにしていると裏垢/不正接続と判定され弾かれる場合があります。一時的にOFFにしてお試しください。', inline: false }
    )
    .setFooter({ text: 'ボタンを押すとページを切り替えられます' })
    .setTimestamp();

  const adminEmbed = new EmbedBuilder()
    .setTitle('🛡️ まつり花火Bot - 管理者向けマニュアル (2/2)')
    .setDescription('⚠️ このページはサーバーの管理者（Administrator権限保持者）にのみ開示されています。')
    .setColor(0xFAA61A)
    .addFields(
      { name: '⚙️ 認証システムのセットアップ', value: '`/v_setup` コマンドを実行して、認証成功時に付与するロール、剥奪するロール（任意）、およびパネルの案内テキストを設定・設置します。', inline: false },
      { name: '🤖 不正・捨て垢自動防衛システム', value: '`/v_antiraid` コマンドで設定可能です。アカウント作成日から指定日数未満の捨てアカウント、およびアバター初期状態（アイコン未設定）のユーザーがサーバーに参加した際、自動でキック(Kick)しログに報告する防衛機能です。', inline: false },
      { name: '🔄 制限の個別リセット', value: '`/v_reset` コマンドを使って、誤ってブロックされてしまった正規ユーザーをサーバー個別に救済（ブロック解除）できます。', inline: false },
      { name: '📜 ログチャンネル設定', value: '`/v_log <status>` コマンドで認証ログや警告ログを送信するチャンネルを設定します。', inline: false },
      { name: '📢 防御機能コマンド一覧', value: '・`/v_antiwebhook`: Webhookスパム保護\n・`/v_risklog`: リスクアカウント参加検知\n・`/v_antieveryone`: @everyone連投削除\n・`/v_antilink`: 同一リンク連投削除\n・`/v_antispam`: メッセージスパム規制', inline: false }
    )
    .setTimestamp();

  return { userEmbed, adminEmbed };
}

// ⏱️ 10秒後に自動消去されるメッセージ送信関数
async function sendTempMessage(channel, content, delay = 10000) {
  const msg = await channel.send(content).catch(() => null);
  if (msg) setTimeout(() => msg.delete().catch(() => null), delay);
}

// -----------------------------------------------------------------
// 📡 リアルタイムメッセージ＆強力防御フィルター
// -----------------------------------------------------------------
client.on('messageCreate', async (message) => {
  if (!message.guild) return;
  
  const config = client.getSettings()[message.guild.id] || {};

  // 1️⃣ Webhookスパム自動削除＆チャンネル結果表示
  if (config.antiWebhook && message.webhookId) {
    const key = `${message.guild.id}-${message.webhookId}`;
    const now = Date.now();
    if (!webhookSpamTracker.has(key)) webhookSpamTracker.set(key, []);
    const timestamps = webhookSpamTracker.get(key);
    timestamps.push(now);

    const recent = timestamps.filter(t => now - t < 3000);
    webhookSpamTracker.set(key, recent);

    if (recent.length >= 3) {
      let msgDeleted = false;
      let webhookDeleted = false;

      try {
        await message.delete();
        msgDeleted = true;
      } catch (e) { msgDeleted = false; }

      try {
        const webhooks = await message.channel.fetchWebhooks();
        const targetWebhook = webhooks.get(message.webhookId);
        if (targetWebhook) {
          await targetWebhook.delete('【セキュリティ】Webhookスパムを自動検知');
          webhookDeleted = true;
        }
      } catch (e) { webhookDeleted = false; }

      const statusText = `🛡️ **[Webhookスパム検知]**\n・スパムメッセージ削除: ${msgDeleted ? '🟢 成功' : '🔴 失敗 (権限不足)'}\n・該当Webhook削除: ${webhookDeleted ? '🟢 成功' : '🔴 失敗 (権限不足)'}`;
      await sendTempMessage(message.channel, statusText, 10000);

      if (!msgDeleted || !webhookDeleted) {
        await sendCustomEmbed(message.guild.id, new EmbedBuilder().setTitle('⚠️ 権限不足警告 (Anti-Webhook)').setColor(0xef4444).setDescription(`メッセージ削除またはWebhook削除権限（Manage Webhooks/Manage Messages）がBotに不足しています。`));
      }
      return;
    }
  }

  // 2️⃣ @everyone 強制削除機能＆表示
  if (config.antiEveryone && (message.content.includes('@everyone') || message.content.includes('@here'))) {
    const isOwnerOrAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator) || message.author.id === '1266013271518089258';
    if (!isOwnerOrAdmin) {
      let isDeleted = false;
      try {
        await message.delete();
        isDeleted = true;
      } catch (e) { isDeleted = false; }

      const msg = `⚠️ <@${message.author.id}> **@everyone / @here の送信は禁止されています。** (${isDeleted ? '🟢 メッセージ自動削除完了' : '🔴 削除失敗: メッセージ管理権限がありません'})`;
      await sendTempMessage(message.channel, msg, 10000);
      return;
    }
  }

  // 3️⃣ 同一リンク 5秒以内 5回連投で自動削除＆表示
  if (config.antiLink) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = message.content.match(urlRegex);
    if (matches) {
      const url = matches[0];
      const key = `${message.guild.id}-${message.channel.id}-${url}`;
      const now = Date.now();

      if (!linkSpamTracker.has(key)) linkSpamTracker.set(key, []);
      const times = linkSpamTracker.get(key);
      times.push(now);

      const recentLinks = times.filter(t => now - t <= 5000);
      linkSpamTracker.set(key, recentLinks);

      if (recentLinks.length >= 5) {
        let isDeleted = false;
        try {
          await message.delete();
          isDeleted = true;
        } catch (e) { isDeleted = false; }

        const msg = `🚨 **同一リンクの短時間連投を検知しました。** (${isDeleted ? '🟢 連投メッセージを削除しました' : '🔴 削除失敗: メッセージ管理権限がありません'})`;
        await sendTempMessage(message.channel, msg, 10000);
        return;
      }
    }
  }

  // 4️⃣ メッセージスパム対策＆表示
  if (config.antiSpam && !message.author.bot) {
    const isOwnerOrAdmin = message.member?.permissions.has(PermissionFlagsBits.Administrator) || message.author.id === '1266013271518089258';
    if (!isOwnerOrAdmin) {
      const key = `${message.guild.id}-${message.author.id}`;
      const now = Date.now();
      if (!userMessageLog.has(key)) userMessageLog.set(key, []);
      const timestamps = userMessageLog.get(key);
      while (timestamps.length > 0 && timestamps[0] <= now - 3000) timestamps.shift();
      timestamps.push(now);

      if (timestamps.length >= 5) {
        userMessageLog.delete(key);
        let isDeleted = false;
        try {
          await message.delete();
          isDeleted = true;
        } catch (e) { isDeleted = false; }

        const botMember = await message.guild.members.fetchMe().catch(() => null);
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);

        let punished = 'なし';
        if (member && botMember) {
          if (botMember.roles.highest.position <= member.roles.highest.position) {
            await sendCustomEmbed(message.guild.id, new EmbedBuilder().setTitle('⚠️ 権限・ロール失敗 (Anti-Spam)').setColor(0xef4444).setDescription(`対象ユーザー <@${member.id}> のロール順位がBotより上のため処罰できませんでした。`));
          } else {
            const timeoutRes = await member.timeout(10 * 60 * 1000, 'スパム自動検知').then(() => true).catch(() => false);
            if (timeoutRes) {
              punished = '10分間タイムアウト';
            } else if (member.kickable) {
              await member.kick('[Spam Protection] スパム連投').catch(() => null);
              punished = 'キック(Kick)';
            }
          }
        }

        const msg = `🚨 **スパム連投を検知・処理しました。**\n・連投メッセージ: ${isDeleted ? '🟢 削除成功' : '🔴 削除失敗'}\n・ユーザー処罰: \`${punished}\``;
        await sendTempMessage(message.channel, msg, 10000);
      }
    }
  }

  // 5️⃣ !help コマンド (DM送信)
  if (message.content.toLowerCase().startsWith('!help')) {
    await message.delete().catch(() => null);
    const isClientAdmin = message.member ? (message.member.permissions.has(PermissionFlagsBits.Administrator) || message.author.id === '1266013271518089258') : false;

    const { userEmbed, adminEmbed } = generateHelpEmbeds(isClientAdmin);

    const btnUser = new ButtonBuilder().setCustomId('help_page_user').setLabel('👥 一般向け').setStyle(ButtonStyle.Primary).setDisabled(true);
    const btnAdmin = new ButtonBuilder().setCustomId('help_page_admin').setLabel(isClientAdmin ? '👑 管理者向け' : '👑 管理者向け (権限なし)').setStyle(ButtonStyle.Secondary).setDisabled(!isClientAdmin);

    try {
      const response = await message.author.send({ 
        embeds: [userEmbed], 
        components: [new ActionRowBuilder().addComponents(btnUser, btnAdmin)] 
      });

      const collector = response.createMessageComponentCollector({ time: 300000 });

      collector.on('collect', async i => {
        if (i.user.id !== message.author.id) return;
        
        if (i.customId === 'help_page_user') {
          btnUser.setDisabled(true).setStyle(ButtonStyle.Primary);
          btnAdmin.setDisabled(!isClientAdmin).setStyle(ButtonStyle.Secondary);
          await i.update({ embeds: [userEmbed], components: [new ActionRowBuilder().addComponents(btnUser, btnAdmin)] }).catch(() => null);
        } else if (i.customId === 'help_page_admin') {
          btnUser.setDisabled(false).setStyle(ButtonStyle.Secondary);
          btnAdmin.setDisabled(true).setStyle(ButtonStyle.Primary);
          await i.update({ embeds: [adminEmbed], components: [new ActionRowBuilder().addComponents(btnUser, btnAdmin)] }).catch(() => null);
        }
      });
    } catch (e) {
      await sendTempMessage(message.channel, `⚠️ <@${message.author.id}> **DMの受信を許可してください。**`, 5000);
    }
    return;
  }
});

// 📥 メンバー参加・AntiRaid自動処罰・参加ログ
client.on('guildMemberAdd', async (member) => {
  const config = client.getSettings()[member.guild.id] || {};
  const botMember = await member.guild.members.fetchMe().catch(() => null);

  // AntiRaid 自動キック処理
  if (config.antiRaid) {
    const isDefaultAvatar = !member.user.avatar;
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    const isNewAccount = accountAgeDays < (config.antiRaidDays || 7);

    if (isDefaultAvatar || isNewAccount) {
      if (!botMember?.permissions.has(PermissionFlagsBits.KickMembers)) {
        await sendCustomEmbed(member.guild.id, new EmbedBuilder().setTitle('⚠️ 権限不足エラー (AntiRaid)').setColor(0xef4444).setDescription(`Botに **メンバーをキック (Kick Members)** 権限が無いため、捨て垢 <@${member.id}> を自動キックできませんでした。`));
      } else if (botMember.roles.highest.position <= member.roles.highest.position) {
        await sendCustomEmbed(member.guild.id, new EmbedBuilder().setTitle('⚠️ ロール位置エラー (AntiRaid)').setColor(0xef4444).setDescription(`対象ユーザー <@${member.id}> の最高ロールがBotと同等以上の位置にあるため自動キックできませんでした。`));
      } else {
        await member.kick('【AntiRaid防衛】初期アイコンまたはアカウント制限日数を満たしていません').catch(() => null);
        await sendCustomEmbed(member.guild.id, new EmbedBuilder().setTitle('🛡️ AntiRaid防衛実行').setColor(0xef4444).setDescription(`不正アカウントを自動キックしました:\n**ユーザー:** <@${member.id}> (\`${member.user.tag}\`)`));
        return;
      }
    }
  }

  if (config.riskLog) {
    const isDefaultAvatar = !member.user.avatar;
    const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
    const isNewAccount = accountAgeDays <= 3;

    if (isDefaultAvatar || isNewAccount) {
      const riskEmbed = new EmbedBuilder()
        .setTitle('⚠️ 【警告】リスクアカウント参加検知')
        .setColor(0xf59e0b)
        .addFields(
          { name: 'ユーザー', value: `<@${member.id}> (\`${member.user.tag}\`)`, inline: true },
          { name: '初期アイコンか', value: isDefaultAvatar ? '⚠️ はい (デフォルト)' : 'いいえ', inline: true },
          { name: 'アカウント作成日', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R> (${Math.floor(accountAgeDays)}日前)`, inline: true }
        )
        .setTimestamp();

      await sendCustomEmbed(member.guild.id, riskEmbed);
    }
  }

  const embed = new EmbedBuilder()
    .setTitle('📥 メンバー参加')
    .setColor(0x22c55e)
    .setDescription(`**ユーザー:** <@${member.id}> (\`${member.user.tag}\`)\n**作成日:** <t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`)
    .setTimestamp();
  await sendCustomEmbed(member.guild.id, embed);
});

// 🗑️ メッセージ削除ログ
client.on('messageDelete', async (message) => {
  if (!message.guild || message.author?.bot) return;
  const embed = new EmbedBuilder()
    .setTitle('🗑️ メッセージ削除')
    .setColor(0xef4444)
    .addFields(
      { name: '送信者', value: `<@${message.author?.id || '不明'}>`, inline: true },
      { name: 'チャンネル', value: `<#${message.channel.id}>`, inline: true },
      { name: '内容', value: message.content ? `\`\`\`${message.content}\`\`\`` : '*（画像または埋め込み）*' }
    ).setTimestamp();
  await sendCustomEmbed(message.guild.id, embed);
});

// ✏️ メッセージ編集ログ
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (!oldMessage.guild || oldMessage.author?.bot || oldMessage.content === newMessage.content) return;
  const embed = new EmbedBuilder()
    .setTitle('✏️ メッセージ編集')
    .setColor(0xf59e0b)
    .addFields(
      { name: '送信者', value: `<@${newMessage.author.id}>`, inline: true },
      { name: 'チャンネル', value: `<#${newMessage.channel.id}>`, inline: true },
      { name: '編集前', value: `\`\`\`${oldMessage.content || 'なし'}\`\`\`` },
      { name: '編集後', value: `\`\`\`${newMessage.content || 'なし'}\`\`\`` }
    ).setTimestamp();
  await sendCustomEmbed(oldMessage.guild.id, embed);
});

// 🔊 VCログ
client.on('voiceStateUpdate', async (oldState, newState) => {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;
  const member = newState.member || oldState.member;
  if (member?.user.bot) return;

  let embed;
  if (!oldState.channelId && newState.channelId) {
    embed = new EmbedBuilder().setTitle('🔊 VC参加').setColor(0x22c55e).setDescription(`<@${member.id}> が <#${newState.channelId}> に参加しました。`);
  } else if (oldState.channelId && !newState.channelId) {
    embed = new EmbedBuilder().setTitle('🔇 VC退出').setColor(0xef4444).setDescription(`<@${member.id}> が <#${oldState.channelId}> から退出しました。`);
  } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    embed = new EmbedBuilder().setTitle('🔀 VC移動').setColor(0x3b82f6).setDescription(`<@${member.id}> が <#${oldState.channelId}> ➡️ <#${newState.channelId}> へ移動しました。`);
  }

  if (embed) {
    embed.setTimestamp();
    await sendCustomEmbed(guild.id, embed);
  }
});

// 🤖 起動処理
client.once('ready', async () => {
  await loadSettingsFromGitHub();
  console.log(`Bot Online: ${client.user.tag}`);
  
  const updatePresence = () => {
    client.user.setActivity(`${client.guilds.cache.size} servers | Ping: ${client.ws.ping}ms`, { type: 0 });
  };
  updatePresence();
  setInterval(updatePresence, 60000);
});

// スラッシュコマンドのロード
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
      client.commands.set(command.data.name, command);
    }
  }
}

// 🎮 インタラクション制御
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) {
      await command.execute(interaction, client).catch(err => console.error(err));
    }
    return;
  }

  // 認証パネルモーダル受取
  if (interaction.isModalSubmit() && interaction.customId.startsWith('v_setup_modal_')) {
    const parts = interaction.customId.split('_');
    const addRoleId = parts[3];
    const removeRoleId = parts[4];
    const panelText = interaction.fields.getTextInputValue('panel_text');

    const embed = new EmbedBuilder().setColor(0x3b82f6).setTitle('🔒 セキュリティ認証').setDescription(panelText).setTimestamp();
    const button = new ButtonBuilder().setCustomId(`v_btn_${addRoleId}_${removeRoleId}`).setLabel('認証').setStyle(ButtonStyle.Success);
    
    await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] }).catch(() => null);
    await interaction.reply({ content: '✅ 認証パネルを正常に設置しました。', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    return;
  }

  // 認証ボタン押下時
  if (interaction.isButton() && interaction.customId.startsWith('v_btn_')) {
    const parts = interaction.customId.split('_');
    const addRoleId = parts[2];
    const removeRoleId = parts[3];

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => null);

    if (addRoleId && interaction.member.roles.cache.has(addRoleId)) {
      return interaction.editReply({ content: '✅ **すでに認証が完了しています。**' }).catch(() => null);
    }

    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, { 
      guildId: interaction.guildId, 
      userId: interaction.user.id, 
      addRoleId, 
      removeRoleId, 
      timestamp: Date.now() 
    });

    const host = 'maturihanabitaikaibot.onrender.com';
    const linkButton = new ButtonBuilder().setLabel('🔗 認証サイトへアクセス（5分間有効）').setStyle(ButtonStyle.Link).setURL(`https://${host}/verify?state=${state}`);
    
    await interaction.editReply({ content: '⚠️ **下のボタンを押してブラウザで認証を完了させてください。**', components: [new ActionRowBuilder().addComponents(linkButton)] }).catch(() => null);
  }
});

// エラーハンドリング
client.on('error', error => console.error('[Discord Error]', error));

// 🌐 サーバー起動
app.listen(PORT, () => console.log(`[Web Server] ポート ${PORT} で稼働中。`));
client.login(process.env.DISCORD_TOKEN);
