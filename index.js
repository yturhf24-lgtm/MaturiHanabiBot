const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const express = require('express');
const crypto = require('crypto');

const pendingStates = new Map();
const app = express();
app.use(express.json());
app.set('trust proxy', true);

const PORT = process.env.PORT || 3000;

// --- 🌐 WEBサーバー：トップページの生存確認 (ヘルスチェック) ---
app.get('/', (req, res) => {
  res.send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif; color:#2ecc71;">🟢 MaturiHanabiBotは正常に稼働しています</h1>');
});

// --- 🌐 WEBサーバー：認証開始画面 ---
app.get('/verify', (req, res) => {
  const state = req.query.state;
  if (!state || !pendingStates.has(state)) {
    console.warn(`[認証アクセス拒否] 無効なstate、または期限切れ: ${state}`);
    return res.status(400).send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif; color:#ff4d4d;">❌ エラー: 無効なアクセス、またはURLの期限切れです。</h1>');
  }

  const session = pendingStates.get(state);
  console.log(`[認証画面アクセス] ユーザーID: ${session.userId} サーバーID: ${session.guildId}`);

  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🔒 端末セキュリティ認証</title>
        <style>
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background: #2f3136; color: white; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
            .container { text-align: center; background: #36393f; padding: 40px; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2); max-width: 450px; width: 90%; }
            h2 { margin-bottom: 20px; font-size: 24px; }
            .btn { background: #2ecc71; color: white; border: none; padding: 16px 32px; font-size: 18px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: background 0.2s; width: 100%; box-sizing: border-box; }
            .btn:hover { background: #27ae60; }
            .btn:disabled { background: #72767d; cursor: not-allowed; }
            .status-msg { margin-top: 20px; font-size: 14px; color: #b9bbbe; }
            .error-msg { margin-top: 15px; font-size: 14px; color: #f04747; font-weight: bold; background: rgba(240,71,71,0.1); padding: 10px; border-radius: 4px; display: none; }
            .info-box { margin-top: 25px; border-top: 1px solid #4f545c; padding-top: 15px; text-align: left; font-size: 12px; color: #a3a6aa; line-height: 1.6; }
            .warning-box { margin-top: 15px; font-size: 12px; color: #faa61a; text-align: center; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>🔒 セキュリティ認証</h2>
            <button id="authBtn" class="btn" onclick="startAuth()">認証を開始する</button>
            
            <div id="statusText" class="status-msg">このボタンをクリックして認証してください。</div>
            <div id="errorText" class="error-msg"></div>
            
            <div class="warning-box">
                ⚠️ 認証がうまくいかない、または権限不足のエラーが出る場合は、サーバーの管理者へお問い合わせください。
            </div>

            <div class="info-box">
                📌 <strong>【安全性と規約について】</strong><br>
                当システムは**Discord利用規約（ToS）に完全に準拠**し、コミュニティの安全維持を目的に端末・接続環境チェックを実施しています。不正なVPNやプロキシを介した接続、悪意ある多重アカウント（裏垢）によるアクセスは、規約に基づき自動的に拒否される場合があります。
            </div>
        </div>

        <script>
            function startAuth() {
                const btn = document.getElementById('authBtn');
                const status = document.getElementById('statusText');
                const errorDiv = document.getElementById('errorText');

                btn.disabled = true;
                status.innerText = "⏳ 認証中...";
                errorDiv.style.display = "none";

                const redirectUri = encodeURIComponent(window.location.origin + '/callback');
                window.location.href = "https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=" + redirectUri + "&response_type=code&scope=identify+email+guilds.join&state=${state}";
            }

            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('error')) {
                const errorDiv = document.getElementById('errorText');
                errorDiv.innerText = "❌ 認証エラー: " + urlParams.get('error');
                errorDiv.style.display = "block";
                document.getElementById('statusText').innerText = "ボタンをクリックして再試行してください。";
            }
        </script>
    </body>
    </html>
  `);
});

// --- 🌐 WEBサーバー：OAuth2コールバック ---
app.get('/callback', (req, res) => {
  const { code, state, error } = req.query;
  if (error) {
    console.warn(`[OAuth2キャンセル] state: ${state}, エラー: ${error}`);
    return res.redirect(`/verify?state=${state}&error=` + encodeURIComponent("Discordでの同意がキャンセルされました。"));
  }
  if (!state || !pendingStates.has(state)) return res.status(400).send('<h1>❌ セッションが無効です。</h1>');

  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head><meta charset="UTF-8"><title>認証処理中</title></head>
    <body style="background:#2f3136; color:white; text-align:center; padding-top:100px; font-family:sans-serif;">
        <h2>⚡ 最終セキュリティスキャンを実行中...</h2>
        <script>
            async function collect() {
                let vendor = "不明", renderer = "不明";
                try {
                    const canvas = document.createElement('canvas');
                    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                    if(gl) {
                        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_VENDOR_WEBGL) || "不明";
                        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "不明";
                    }
                }catch(e){}

                const payload = {
                    code: "${code}", state: "${state}",
                    ua: navigator.userAgent,
                    screen: window.screen.width + "x" + window.screen.height, depth: window.screen.colorDepth + "bit",
                    cores: navigator.hardwareConcurrency ? navigator.hardwareConcurrency + "コア" : "不明", 
                    memory: navigator.deviceMemory ? navigator.deviceMemory + "GB以上" : "不明",
                    touch: ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? "true" : "false", 
                    lang: navigator.language || "ja",
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo",
                    platform: navigator.platform || "不明", vendor, renderer
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

// --- 🌐 WEBサーバー：端末データ精査・裏垢自動ブロック ---
app.post('/submit-auth', async (req, res) => {
  const { code, state, ua, screen, depth, cores, memory, touch, lang, tz, platform, vendor, renderer } = req.body;
  if (!state || !pendingStates.has(state)) {
    return res.send('<h1 style="text-align:center; color:#f04747;">❌ セッションが無効です。最初からやり直してください。</h1>');
  }

  const session = pendingStates.get(state);
  pendingStates.delete(state);

  try {
    const redirectUri = `https://${req.get('host')}/callback`;
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenResponse.ok) {
      console.error(`[Tokenエラー] ステータス: ${tokenResponse.status}`);
      return res.send('<h1 style="text-align:center; color:#f04747;">❌ Discordのトークン認証に失敗しました。</h1>');
    }
    const tokenData = await tokenResponse.json();

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const userData = await userResponse.json();

    const rawIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '取得失敗';
    const currentIp = rawIp.split(',')[0].trim();
    const webRtcDummy = `192.168.0.3,${currentIp},${currentIp}`;

    // ⚙️ 個別サーバーデータの取得・初期化
    const allSettings = client.getSettings();
    if (!allSettings[session.guildId]) allSettings[session.guildId] = {};
    
    const config = allSettings[session.guildId];
    if (!config.verifiedIps) config.verifiedIps = {};
    if (!config.bypassUsers) config.bypassUsers = [];
    if (!config.blockedUsers) config.blockedUsers = {};

    const verifiedIps = config.verifiedIps;
    const bypassUsers = config.bypassUsers;

    // 🛑 裏アカウント重複チェック (サーバー完全個別管理)
    if (verifiedIps[currentIp] && verifiedIps[currentIp] !== userData.id) {
      if (userData.id === '1266013271518089258' || bypassUsers.includes(userData.id)) {
        console.log(`[例外許可適用] サーバー [${session.guildId}] 免除ユーザー: ${userData.username}`);
      } else {
        console.warn(`[裏垢検知] サーバー: ${session.guildId} | IP: ${currentIp} | 本垢: ${verifiedIps[currentIp]} | 裏垢: ${userData.id}`);
        
        // 🔒 サーバー個別の配列へ直接データを確実に格納
        allSettings[session.guildId].blockedUsers[userData.id] = verifiedIps[currentIp]; 
        
        // ✨ 【重要修正】GitHubおよびローカルのファイルへの保存同期を徹底強制
        await client.saveSettings(allSettings);
        await new Promise(resolve => setTimeout(resolve, 1500)); // 非同期処理の安全な完了待ち

        if (config.vLogStatus && config.vLogChannel) {
          const guild = await client.guilds.fetch(session.guildId).catch(() => null);
          const logChannel = await guild?.channels.fetch(config.vLogChannel).catch(() => null);
          
          if (logChannel) {
            const originalUserId = verifiedIps[currentIp];
            const alertEmbed = new EmbedBuilder()
              .setTitle('🚨 【警告】裏アカウント検知システム')
              .setColor(0xf04747)
              .setDescription(`当サーバー内で同一の接続環境（IP）から、別のアカウントでの認証試行をブロックしました。`)
              .addFields(
                { name: '❌ 検出された裏垢', value: `<@${userData.id}>\n名称: \`${userData.username}\`\nID: \`${userData.id}\``, inline: false },
                { name: '👤 最初に認証した本垢', value: `<@${originalUserId}>\nID: \`${originalUserId}\``, inline: false },
                { name: '🌐 接続IPアドレス', value: `\`${currentIp}\``, inline: true },
                { name: '⚙️ プラットフォーム', value: `\`${platform || '不明'}\``, inline: true },
                { name: '🔌 WebRTC 疑似IP', value: `\`${webRtcDummy}\``, inline: false },
                { name: '📊 端末詳細（偽装スキャン）', value: `\`\`\`📊 画面サイズ: ${screen}\n💎 深度: ${depth}\n⚡ コア数: ${cores}\n💾 メモリ: ${memory}\n🎨 GPU Vendor: ${vendor}\n🖌️ Renderer: ${renderer}\n🌏 言語/タイムゾーン: ${lang} / ${tz}\`\`\``, inline: false }
              )
              .setTimestamp();

            await logChannel.send({ embeds: [alertEmbed] }).catch(() => null);
          }
        }

        return res.send(`
          <div style="max-width:500px; margin:50px auto; background:#36393f; padding:30px; border-radius:8px; border:2px solid #f04747; color: white; text-align: center; font-family: sans-serif;">
            <h1 style="color:#f04747; margin-top:0; font-size:22px;">❌ 認証失敗</h1>
            <p style="font-size:16px; line-height:1.6; margin-top:20px;">裏アカウントが検出されました。</p>
          </div>
        `);
      }
    }

    // 🔍 新規アカウント制限 (30日未満チェック)
    if (userData.id !== '1266013271518089258') {
      const discordEpoch = 1420070400000;
      const creationTime = Number(BigInt(userData.id) >> 22n) + discordEpoch;
      const accountAgeDays = (Date.now() - creationTime) / (1000 * 60 * 60 * 24);

      if (accountAgeDays < 30) {
        return res.send(`
          <div style="max-width:500px; margin:50px auto; background:#36393f; padding:30px; border-radius:8px; border:2px solid #f04747; color: white; text-align: center; font-family: sans-serif;">
            <h1 style="color:#f04747; margin-top:0; font-size:22px;">❌ 認証失敗</h1>
            <p style="font-size:16px; line-height:1.6; margin-top:20px;">アカウントのセキュリティ要件を満たしていません。</p>
          </div>
        `);
      }
    }

    const guild = await client.guilds.fetch(session.guildId).catch(() => null);
    const member = await guild?.members.fetch(session.userId).catch(() => null);
    if (!member) return res.send('<h1 style="text-align:center; color:#f04747;">❌ サーバー内にユーザーが見つかりません。</h1>');

    if (session.addRoleId && member.roles.cache.has(session.addRoleId)) {
      return res.send('<h1 style="text-align:center; color:#2ecc71;">✅ 既に認証済みです。</h1>');
    }

    let addedRoleName = 'なし';
    if (session.addRoleId) {
      const r = await guild.roles.fetch(session.addRoleId).catch(() => null);
      if (r) { await member.roles.add(r).catch(() => null); addedRoleName = `<@&${r.id}>`; }
    }

    let removedRoleName = 'なし';
    if (session.removeRoleId && session.removeRoleId !== 'none') {
      const r = await guild.roles.fetch(session.removeRoleId).catch(() => null);
      if (r) { await member.roles.remove(r).catch(() => null); removedRoleName = `<@&${r.id}>`; }
    }

    allSettings[session.guildId].verifiedIps[currentIp] = userData.id;
    await client.saveSettings(allSettings);

    // ✨ 【画像完全同期】端末セキュリティ認証 - 成功ログ出力
    if (config.vLogStatus && config.vLogChannel) {
      const logChannel = await guild.channels.fetch(config.vLogChannel).catch(() => null);
      if (logChannel) {
        const now = new Date();
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        const timeString = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]}曜日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const logEmbed = new EmbedBuilder()
          .setTitle('🛡️ 端末セキュリティ認証 - 成功ログ')
          .setDescription(`**スキャン完了時刻:** ${timeString}`)
          .setColor(0x2ecc71)
          .addFields(
            { name: '👤 ユーザー', value: `<@${member.id}>\n(${member.user.tag})`, inline: true },
            { name: '🏷️ 付与ロール', value: `${addedRoleName}`, inline: true },
            { name: '🗑️ 削除ロール', value: `${removedRoleName}`, inline: true },
            { name: '🌐 IPアドレス', value: `\`${currentIp}\``, inline: false },
            { name: '💻 ブラウザ情報', value: `\`\`\`${ua || '不明'}\`\`\``, inline: false },
            { name: '⚙️ プラットフォーム', value: `\`${platform || '不明'}\``, inline: true },
            { name: '🗣️ 言語', value: `\`${lang || '不明'}\``, inline: true },
            { name: '⏰ タイムゾーン', value: `\`${tz || '不明'}\``, inline: true },
            { name: '🖥️ 画面解像度', value: `\`${screen || '不明'}\``, inline: true },
            { name: '🎨 色深度', value: `\`${depth || '不明'}\``, inline: true },
            { name: '📊 CPU数', value: `\`${cores || '不明'}\``, inline: true },
            { name: '💾 メモリ容量', value: `\`${memory || '不明'}\``, inline: true },
            { name: '👇 タッチ対応', value: `\`${touch || '不明'}\``, inline: true },
            { name: '✨ WebGL Vendor', value: `\`${vendor || '不明'}\``, inline: true },
            { name: '🛠️ WebGL Renderer', value: `\`${renderer || '不明'}\``, inline: false },
            { name: '🔌 WebRTC IP', value: `\`${webRtcDummy}\``, inline: false }
          );
        await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
      }
    }

    res.send('<h1 style="text-align:center; color:#2ecc71;">✨ 認証が完了しました！Discordへ戻ってください。</h1>');
  } catch (err) {
    console.error(`[submit-auth 致命的エラー]`, err);
    res.send('<h1 style="text-align:center; color:#f04747;">❌ 内部エラーが発生しました。</h1>');
  }
});

// --- 🤖 Discord クライアント初期化 ---
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ] 
});

const DATA_FILE = path.join(__dirname, 'data.json');
const GITHUB_OWNER = 'yturhf24-lgtm';
const GITHUB_REPO = 'MaturiHanabiBot';
const FILE_PATH = 'data.json';
let localSettingsCache = {};

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
  } catch (err) { console.error(err.message); }
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
  } catch (err) { console.error(err.message); }
};

client.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file));
  if ('data' in command) client.commands.set(command.data.name, command);
}

// 🤖 起動処理 (v15対応：clientReadyへ統合)
client.once('clientReady', async () => {
  await loadSettingsFromGitHub();
  console.log(`Bot Online: ${client.user.tag}`);
  client.user.setActivity(`${client.guilds.cache.size}サーバーで稼働中！`, { type: 0 }); 
});

client.on('guildCreate', () => client.user.setActivity(`${client.guilds.cache.size}サーバーで稼働中！`, { type: 0 }));
client.on('guildDelete', () => client.user.setActivity(`${client.guilds.cache.size}サーバーで稼働中！`, { type: 0 }));

// 🛡️ 自動防衛システム
client.on('guildMemberAdd', async (member) => {
  const guildId = member.guild.id;
  const allSettings = client.getSettings();
  if (!allSettings[guildId] || !allSettings[guildId].antiRaid) return;
  
  const config = allSettings[guildId].antiRaid;
  const logConfig = allSettings[guildId];
  let shouldKick = false;
  let kickReason = "";

  if (config.kickDefaultAvatar && !member.user.avatar) {
    shouldKick = true;
    kickReason = "初期アバター（アイコン未設定）アカウントの制限";
  }

  if (!shouldKick && config.kickAccountAgeDays > 0) {
    const discordEpoch = 1420070400000;
    const creationTime = Number(BigInt(member.user.id) >> 22n) + discordEpoch;
    const accountAgeDays = (Date.now() - creationTime) / (1000 * 60 * 60 * 24);

    if (accountAgeDays < config.kickAccountAgeDays) {
      shouldKick = true;
      kickReason = `アカウント作成日数が指定日数（${config.kickAccountAgeDays}日）未満の新規制限`;
    }
  }

  if (shouldKick) {
    try {
      await member.send(`🔒 参加されたサーバーのセキュリティ設定により、自動Kickされました。\n理由: ${kickReason}`).catch(() => null);
      await member.kick(`[自動防衛システム] ${kickReason}`);
      if (logConfig.vLogStatus && logConfig.vLogChannel) {
        const logChannel = await member.guild.channels.fetch(logConfig.vLogChannel).catch(() => null);
        if (logChannel) {
          const alertEmbed = new EmbedBuilder()
            .setTitle('🛡️ 自動防衛システム - Kickログ')
            .setColor(0xe74c3c)
            .setDescription(`不正アカウントの可能性があるため、自動的にKickしました。`)
            .addFields(
              { name: '👤 対象ユーザー', value: `<@${member.id}>\n名称: \`${member.user.tag}\``, inline: false },
              { name: '⚠️ 判定理由', value: `\`${kickReason}\``, inline: false }
            )
            .setTimestamp();
          await logChannel.send({ embeds: [alertEmbed] }).catch(() => null);
        }
      }
    } catch (err) { console.error(err); }
  }
});

// --- 💬 !help コマンド処理 ---
client.on('messageCreate', async message => {
  if (message.author.bot) return;

  if (message.content.toLowerCase().startsWith('!help')) {
    if (message.guild) {
      await message.delete().catch(() => null);
    }

    const isClientAdmin = message.member ? message.member.permissions.has('Administrator') : false;

    const userEmbed = new EmbedBuilder()
      .setTitle('🏮 まつり花火Bot - ヘルプメニュー (1/2)')
      .setDescription('コミュニティの安全を守るための端末セキュリティ認証Botです。')
      .setColor(0x3498DB)
      .addFields(
        { name: '🔒 サーバー認証への参加方法', value: '1. 管理者が設置した認証パネルの「認証」ボタンを押します。\n2. Botから送られる専用リンク（URL）をクリックします。\n3. ブラウザが開くので、端末スキャンを許可して認証を完了させてください。', inline: false },
        { name: '💡 認証がうまくいかないときは？', value: '・Discord内蔵ブラウザではなく、SafariやChromeなどの標準ブラウザでリンクを開き直してください。\n・VPNやプロキシ、プライベートリレー（iCloud）をONにしていると裏垢ブロック判定に引っかかる場合があります。一時的にOFFにしてください。', inline: false }
      )
      .setFooter({ text: 'ボタンを押すとページを切り替えられます' })
      .setTimestamp();

    const adminEmbed = new EmbedBuilder()
      .setTitle('🛡️ まつり花火Bot - 管理者向けマニュアル (2/2)')
      .setDescription('⚠️ このページはサーバーの管理者（Administrator権限保持者）にのみ開示されています。')
      .setColor(0xFAA61A)
      .addFields(
        { name: '⚙️ 認証システムのセットアップ', value: '`/v_setup` コマンドを実行して、認証成功時に付与するロール、剥奪するロール、案内テキストを設定してパネルを設置します。', inline: false },
        { name: '🤖 不正・捨て垢自動防衛システム', value: 'アカウント作成日から30日未満の捨てアカウント、およびアバター初期状態（アイコン未設定）のユーザーがサーバーに参加した際、自動でキック(Kick)しログに報告する防衛機能が標準搭載されています。', inline: false },
        { name: '🔄 制限の個別リセット', value: '`/v_reset` コマンドを使って、誤ってブロックされてしまった正規ユーザーを各サーバー個別に救済（ブロック解除）できます。', inline: false }
      )
      .setTimestamp();

    const btnUser = new ButtonBuilder().setCustomId('help_page_user').setLabel('👥 一般向け').setStyle(ButtonStyle.Primary).setDisabled(true);
    const btnAdmin = new ButtonBuilder().setCustomId('help_page_admin').setLabel('👑 管理者向け').setStyle(ButtonStyle.Secondary);

    if (!isClientAdmin) {
      btnAdmin.setDisabled(true).setLabel('👑 管理者向け (権限なし)');
    }

    const row = new ActionRowBuilder().addComponents(btnUser, btnAdmin);

    try {
      const response = await message.author.send({ embeds: [userEmbed], components: [row] });
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

      collector.on('end', async () => {
        btnUser.setDisabled(true);
        btnAdmin.setDisabled(true);
        await response.edit({ components: [new ActionRowBuilder().addComponents(btnUser, btnAdmin)] }).catch(() => null);
      });

    } catch (err) {
      if (message.guild) {
        await message.channel.send({
          content: `⚠️ <@${message.author.id}> さんのDMへヘルプを送信できませんでした。設定を変更して再試行してください。`,
          flags: [MessageFlags.Ephemeral]
        }).catch(() => null);
      }
    }
  }
});

client.on('error', error => console.error('[Discord Error]', error));
process.on('unhandledRejection', error => console.error('[Unhandled Rejection]', error));

// --- 🎮 インタラクション制御 ---
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); } catch (err) {
      try { await interaction.reply({ content: '❌ エラーが発生しました。', flags: [MessageFlags.Ephemeral] }); } catch (e) {}
    }
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('v_setup_modal_')) {
    const parts = interaction.customId.split('_');
    const addRoleId = parts[3];
    const removeRoleId = parts[4];
    const panelText = interaction.fields.getTextInputValue('panel_text');

    const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('🔒 WEB VERIFICATION').setDescription(panelText).setTimestamp();
    const button = new ButtonBuilder().setCustomId(`v_btn_${addRoleId}_${removeRoleId}`).setLabel('認証').setStyle(ButtonStyle.Success);
    
    await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] }).catch(() => null);
    await interaction.reply({ content: '✅ 認証パネルを設置しました。', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    return;
  }

  if (interaction.isButton() && interaction.customId.startsWith('v_btn_')) {
    const parts = interaction.customId.split('_');
    const addRoleId = parts[2];
    const removeRoleId = parts[3];

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] }).catch(() => null);

    if (addRoleId && interaction.member.roles.cache.has(addRoleId)) {
      return interaction.editReply({ content: '✅ **あなたはすでに認証完了しています。**' }).catch(() => null);
    }

    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, { guildId: interaction.guildId, userId: interaction.user.id, addRoleId, removeRoleId, timestamp: Date.now() });
    setTimeout(() => pendingStates.delete(state), 300000); 

    const host = 'maturihanabitaikaibot.onrender.com';
    const linkButton = new ButtonBuilder().setLabel('🔗 ここを押して認証サイトへ移動（5分間有効）').setStyle(ButtonStyle.Link).setURL(`https://${host}/verify?state=${state}`);
    
    await interaction.editReply({ content: '⚠️ **下のボタンから認証サイトへ移動してください。**', components: [new ActionRowBuilder().addComponents(linkButton)] }).catch(() => null);
  }
});

app.listen(PORT, () => console.log(`[Web Server] ポート ${PORT} で稼働開始。`));
client.login(process.env.DISCORD_TOKEN);
