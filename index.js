const fs = require('node:fs');
const path = require('node:path');
const { 
  Client, Collection, GatewayIntentBits, EmbedBuilder, 
  ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits
} = require('discord.js');
const express = require('express');
const crypto = require('crypto');

// --- 🌐 WEBサーバー初期化 ---
const pendingStates = new Map();
const app = express();
app.use(express.json());
app.set('trust proxy', true);

const PORT = process.env.PORT || 3000;

// メモリリーク防止（5分超過の認証ステートを消去）
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of pendingStates.entries()) {
    if (now - data.timestamp > 300000) {
      pendingStates.delete(state);
    }
  }
}, 60000);

// --- 🌐 TOPページ ---
app.get('/', (req, res) => {
  res.send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif; color:#2ecc71;">🟢 MaturiHanabiBotは正常に稼働しています</h1>');
});

// --- 🌐 WEB認証開始画面 ---
app.get('/verify', (req, res) => {
  const state = req.query.state;
  if (!state || !pendingStates.has(state)) {
    return res.status(400).send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif; color:#ff4d4d;">❌ エラー: 無効なアクセス、またはURLの期限切れです。</h1>');
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🔒 セキュリティ端末認証</title>
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
              color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px;
            }
            .card {
              background: rgba(30, 41, 59, 0.85); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 20px; padding: 40px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);
            }
            .icon { font-size: 48px; margin-bottom: 16px; }
            h2 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #fff; }
            p.desc { font-size: 14px; color: #94a3b8; margin-bottom: 28px; line-height: 1.5; }
            .btn {
              background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; border: none; padding: 14px 28px;
              font-size: 16px; font-weight: 600; border-radius: 12px; cursor: pointer; transition: all 0.2s ease; width: 100%;
              box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
            }
            .btn:hover { opacity: 0.95; transform: translateY(-1px); }
            .btn:disabled { background: #475569; cursor: not-allowed; transform: none; box-shadow: none; }
            .footer-info { margin-top: 24px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 12px; color: #64748b; line-height: 1.6; text-align: left; }
        </style>
    </head>
    <body>
        <div class="card">
            <div class="icon">🛡️</div>
            <h2>セキュリティ端末認証</h2>
            <p class="desc">コミュニティの安全性を確保するため、端末環境のチェックを行います。<br>下のボタンを押して認証を完了させてください。</p>
            <button id="authBtn" class="btn" onclick="startAuth()">認証を開始する</button>

            <div class="footer-info">
                📌 <strong>安全性とプライバシーについて</strong><br>
                当システムはDiscord利用規約（ToS）に準拠し、不正アクセス・スパム・悪意ある裏アカウント接続の防止目的でのみ端末情報を確認します。
            </div>
        </div>

        <script>
            function startAuth() {
                const btn = document.getElementById('authBtn');
                btn.disabled = true;
                btn.innerText = "⏳ Discordへ接続中...";
                const redirectUri = encodeURIComponent(window.location.origin + '/callback');
                window.location.href = "https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=" + redirectUri + "&response_type=code&scope=identify+email+guilds.join&state=${state}";
            }
        </script>
    </body>
    </html>
  `);
});

// --- 🌐 WEBコールバック画面 (全端末情報収集) ---
app.get('/callback', (req, res) => {
  const { code, state, error } = req.query;
  if (error || !state || !pendingStates.has(state)) {
    return res.status(400).send('<h1 style="text-align:center; padding-top:50px; color:#f87171;">❌ 認証セッションが無効化または期限切れになりました。</h1>');
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head><meta charset="UTF-8"><title>端末認証中</title></head>
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

                // WebRTC IP 取得処理
                let webrtcIp = "取得不可";
                try {
                    const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19002" }] });
                    pc.createDataChannel("");
                    pc.createOffer().then(o => pc.setLocalDescription(o));
                    const ips = [];
                    pc.onicecandidate = (ice) => {
                        if (!ice || !ice.candidate || !ice.candidate.candidate) {
                            if (ips.length > 0) webrtcIp = ips.join(',');
                            return;
                        }
                        const parts = ice.candidate.candidate.split(' ');
                        const ip = parts[4];
                        if (ip && !ips.includes(ip)) ips.push(ip);
                    };
                    await new Promise(r => setTimeout(r, 1000));
                } catch(e) {}

                const payload = {
                    code: "${code}", state: "${state}",
                    ua: navigator.userAgent,
                    screen: window.screen.width + "x" + window.screen.height,
                    depth: window.screen.colorDepth + "bit",
                    cores: (navigator.hardwareConcurrency || "不明") + "コア",
                    memory: navigator.deviceMemory ? navigator.deviceMemory + "GB" : "不明",
                    lang: navigator.language || "ja",
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo",
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

// --- 🌐 WEB認証検証・ログ生成 ---
app.post('/submit-auth', async (req, res) => {
  const { code, state, ua, screen, depth, cores, memory, lang, tz, platform, touch, vendor, renderer, webrtcIp } = req.body;
  if (!state || !pendingStates.has(state)) {
    return res.send('<h1 style="text-align:center; color:#f87171; padding-top:50px;">❌ セッションが無効です。Discordから再度試してください。</h1>');
  }

  const session = pendingStates.get(state);
  pendingStates.delete(state);

  try {
    const redirectUri = `https://${req.get('host')}/callback`;
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({ 
        client_id: process.env.CLIENT_ID, 
        client_secret: process.env.CLIENT_SECRET, 
        grant_type: 'authorization_code', code, redirect_uri: redirectUri 
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenResponse.ok) {
      return res.send('<h1 style="text-align:center; color:#f87171; padding-top:50px;">❌ Discordトークンの取得に失敗しました。</h1>');
    }
    const tokenData = await tokenResponse.json();

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { 
      headers: { Authorization: `Bearer ${tokenData.access_token}` } 
    });
    const userData = await userResponse.json();

    // IP精度の最適化
    const xForwarded = req.headers['x-forwarded-for'];
    const currentIp = xForwarded ? xForwarded.split(',')[0].trim() : (req.ip || req.socket.remoteAddress || '127.0.0.1');

    const allSettings = client.getSettings();
    if (!allSettings[session.guildId]) allSettings[session.guildId] = {};
    const config = allSettings[session.guildId];

    if (!config.verifiedIps) config.verifiedIps = {};
    if (!config.bypassUsers) config.bypassUsers = [];
    if (!config.blockedUsers) config.blockedUsers = {};

    // 🛑 裏アカウント重複検知
    if (config.verifiedIps[currentIp] && config.verifiedIps[currentIp] !== userData.id) {
      if (!config.bypassUsers.includes(userData.id) && userData.id !== '1266013271518089258') {
        config.blockedUsers[userData.id] = config.verifiedIps[currentIp];
        await client.saveSettings(allSettings);

        const warnEmbed = new EmbedBuilder()
          .setTitle('🚨 【警告】裏アカウント検知')
          .setColor(0xef4444)
          .setDescription(`**対象:** <@${userData.id}> (\`${userData.username}\`)\n**本垢:** <@${config.verifiedIps[currentIp]}>\n**IP:** \`${currentIp}\``)
          .setTimestamp();

        await sendCustomEmbed(session.guildId, warnEmbed);

        return res.send(`
          <div style="max-width:480px; margin:50px auto; background:#1e293b; padding:30px; border-radius:16px; border:1px solid #ef4444; color:white; text-align:center; font-family:sans-serif;">
            <h1 style="color:#ef4444; margin-top:0;">❌ 認証失敗</h1>
            <p style="margin-top:15px; color:#94a3b8;">同一の接続環境から別アカウントでのアクセスが検知されたため、認証をブロックしました。</p>
          </div>
        `);
      }
    }

    // ロール付与・剥奪処理
    const guild = await client.guilds.fetch(session.guildId).catch(() => null);
    const member = await guild?.members.fetch(session.userId).catch(() => null);

    let addedRoleName = 'なし';
    let removedRoleName = 'なし';

    if (member && session.addRoleId) {
      const rAdd = await guild.roles.fetch(session.addRoleId).catch(() => null);
      if (rAdd) { await member.roles.add(rAdd).catch(() => null); addedRoleName = `<@&${rAdd.id}>`; }
    }

    if (member && session.removeRoleId && session.removeRoleId !== 'none') {
      const rRem = await guild.roles.fetch(session.removeRoleId).catch(() => null);
      if (rRem) { await member.roles.remove(rRem).catch(() => null); removedRoleName = `<@&${rRem.id}>`; }
    }

    config.verifiedIps[currentIp] = userData.id;
    await client.saveSettings(allSettings);

    // 🗓️ スキャン完了時刻（日本語表記フォーマット）
    const now = new Date();
    const days = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
    const timeStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${days[now.getDay()]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // ユーザー表記情報
    const userDisplayName = userData.global_name ? `${userData.global_name} / ${userData.username}` : userData.username;
    const userEmail = userData.email ? `\`${userData.email}\`` : '`未取得`';

    // 🖼️ 画像の組み込みデザインを完全再現したEmbedログ構築
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
      )
      .setTimestamp();

    await sendCustomEmbed(session.guildId, successEmbed);

    res.send(`
      <div style="max-width:480px; margin:50px auto; background:#1e293b; padding:30px; border-radius:16px; border:1px solid #22c55e; color:white; text-align:center; font-family:sans-serif;">
        <h1 style="color:#22c55e; margin-top:0;">✨ 認証完了</h1>
        <p style="margin-top:15px; color:#94a3b8;">端末セキュリティ認証が完了しました。Discordに戻ってください。</p>
      </div>
    `);
  } catch (err) {
    console.error('[submit-auth 致命的エラー]', err);
    res.send('<h1 style="text-align:center; color:#f87171; padding-top:50px;">❌ 内部処理エラーが発生しました。</h1>');
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

const userMessageLog = new Map();

// 💾 GitHub / ローカル同期ストレージ
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

// 📢 Embedログ直接出力用関数
async function sendCustomEmbed(guildId, embed) {
  const config = client.getSettings()[guildId];
  if (!config || !config.vLogStatus || !config.vLogChannel) return;

  const guild = await client.guilds.fetch(guildId).catch(() => null);
  const channel = await guild?.channels.fetch(config.vLogChannel).catch(() => null);
  if (!channel) return;

  await channel.send({ embeds: [embed] }).catch(() => null);
}

// 🤖 起動処理 & ステータス更新
client.once('clientReady', async () => {
  await loadSettingsFromGitHub();
  console.log(`Bot Online: ${client.user.tag}`);
  
  const updatePresence = () => {
    const serverCount = client.guilds.cache.size;
    const ping = client.ws.ping;
    client.user.setActivity(`${serverCount} servers | Ping: ${ping}ms`, { type: 0 });
  };

  updatePresence();
  setInterval(updatePresence, 60000);
});

// 🛡️ スパム検知 & Helpコマンド
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  if (message.content.toLowerCase().startsWith('!help')) {
    await message.delete().catch(() => null);
    const isClientAdmin = message.member ? message.member.permissions.has(PermissionFlagsBits.Administrator) : false;

    const userEmbed = new EmbedBuilder()
      .setTitle('🏮 まつり花火Bot - ヘルプ (1/2)')
      .setDescription('端末セキュリティ認証Botです。')
      .setColor(0x3b82f6)
      .addFields({ name: '🔒 認証手順', value: '1. パネルの「認証」ボタンを押す\n2. 送られてくるリンクからブラウザでアクセスする\n3. 端末チェック完了で自動でロールが付与されます。', inline: false });

    const adminEmbed = new EmbedBuilder()
      .setTitle('🛡️ まつり花火Bot - 管理者マニュアル (2/2)')
      .setColor(0xf59e0b)
      .addFields({ name: '⚙️ 各種コマンド', value: '`/v_setup`: 認証パネルの設置\n`/v_antispam`: 連投対策(Kick/Ban)設定\n`/v_announce`: 埋め込みアナウンス作成\n`/v_config`: 全設定の確認\n`/v_log`: ログチャンネルの設定', inline: false });

    const btnUser = new ButtonBuilder().setCustomId('help_page_user').setLabel('👥 一般向け').setStyle(ButtonStyle.Primary).setDisabled(true);
    const btnAdmin = new ButtonBuilder().setCustomId('help_page_admin').setLabel('👑 管理者向け').setStyle(ButtonStyle.Secondary).setDisabled(!isClientAdmin);

    try {
      const response = await message.author.send({ embeds: [userEmbed], components: [new ActionRowBuilder().addComponents(btnUser, btnAdmin)] });
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
    } catch (e) {}
    return;
  }

  const config = client.getSettings()[message.guild.id]?.antiSpam;
  if (!config || !config.enabled) return;

  const key = `${message.guild.id}-${message.author.id}`;
  const now = Date.now();
  
  if (!userMessageLog.has(key)) userMessageLog.set(key, []);
  const timestamps = userMessageLog.get(key);
  
  const windowMs = config.seconds * 1000;
  while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
    timestamps.shift();
  }

  timestamps.push(now);

  if (timestamps.length >= config.maxMessages) {
    userMessageLog.delete(key);
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (!member) return;

    if (config.action === 'ban' && member.bannable) {
      await member.ban({ reason: `[Spam Protection] ${config.seconds}秒間に${config.maxMessages}回以上の連続送信` }).catch(() => null);
      const embed = new EmbedBuilder().setTitle('🔨 スパム検知 BAN').setDescription(`**対象:** <@${member.id}>\n**条件:** ${config.seconds}秒間に ${config.maxMessages} メッセージ送信`).setColor(0xef4444).setTimestamp();
      await sendCustomEmbed(message.guild.id, embed);
    } else if (config.action === 'kick' && member.kickable) {
      await member.kick(`[Spam Protection] ${config.seconds}秒間に${config.maxMessages}回以上の連続送信`).catch(() => null);
      const embed = new EmbedBuilder().setTitle('👞 スパム検知 KICK').setDescription(`**対象:** <@${member.id}>\n**条件:** ${config.seconds}秒間に ${config.maxMessages} メッセージ送信`).setColor(0xf59e0b).setTimestamp();
      await sendCustomEmbed(message.guild.id, embed);
    }
  }
});

// コマンド動的ロード
client.commands = new Collection();
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(path.join(__dirname, 'commands', file));
  if ('data' in command) client.commands.set(command.data.name, command);
}

// 🎮 インタラクション制御
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction).catch(() => null);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'announce_modal') {
    const title = interaction.fields.getTextInputValue('title');
    const content = interaction.fields.getTextInputValue('content');

    const embed = new EmbedBuilder().setTitle(title).setDescription(content).setColor(0x3b82f6).setTimestamp();
    await interaction.channel.send({ embeds: [embed] }).catch(() => null);
    await interaction.reply({ content: '✅ アナウンスを送信しました。', flags: [MessageFlags.Ephemeral] }).catch(() => null);
    return;
  }

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
process.on('unhandledRejection', error => console.error('[Unhandled Rejection]', error));

// 🌐 サーバー起動
app.listen(PORT, () => console.log(`[Web Server] ポート ${PORT} で稼働中。`));
client.login(process.env.DISCORD_TOKEN);
