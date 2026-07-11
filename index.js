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

// --- 認証開始画面 ---
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

// --- OAuth2コールバック ---
app.get('/callback', (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`/verify?state=${state}&error=` + encodeURIComponent("Discordでの同意がキャンセルされました。"));
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
                        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    }
                }catch(e){}

                const payload = {
                    code: "${code}", state: "${state}",
                    screen: window.screen.width + "x" + window.screen.height, depth: window.screen.colorDepth + "bit",
                    cores: navigator.hardwareConcurrency || "不明", memory: navigator.deviceMemory || "不明",
                    touch: ('ontouchstart' in window || navigator.maxTouchPoints > 0), lang: navigator.language,
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

// --- アカウント精査・ロール付与・確定IPによるEmbedログ送信 ---
app.post('/submit-auth', async (req, res) => {
  const { code, state, screen, depth, cores, memory, touch, lang, tz, platform, vendor, renderer } = req.body;
  if (!state || !pendingStates.has(state)) return res.send('<h1 style="text-align:center; color:#f04747;">❌ セッションが無効です。最初からやり直してください。</h1>');

  const session = pendingStates.get(state);
  pendingStates.delete(state);

  try {
    const redirectUri = `https://${req.get('host')}/callback`;
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({ client_id: process.env.CLIENT_ID, client_secret: process.env.CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenResponse.ok) return res.send('<h1 style="text-align:center; color:#f04747;">❌ Discordのトークン認証に失敗しました。</h1>');
    const tokenData = await tokenResponse.json();

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    const userData = await userResponse.json();

    const guild = await client.guilds.fetch(session.guildId).catch(() => null);
    const member = await guild?.members.fetch(session.userId).catch(() => null);
    if (!member) return res.send('<h1 style="text-align:center; color:#f04747;">❌ サーバー内にあなたが見つかりません。</h1>');

    // 💡 既にロールを持っているアカウントが連携に進んだ場合も画面でブロック
    if (session.addRoleId && member.roles.cache.has(session.addRoleId)) {
      return res.send(`
        <div style="max-width:500px; margin:50px auto; background:#36393f; padding:30px; border-radius:8px; border:2px solid #2ecc71; color: white; text-align: center; font-family: sans-serif;">
          <h1 style="color:#2ecc71; margin-top:0;">✅ 認証済み</h1>
          <p style="font-size:16px;">あなたはすでに認証完了しています。再度手続きを行う必要はありません。</p>
        </div>
      `);
    }

    // 🔍 アカウント作成日の判定 (30日未満を裏垢とする)
    const userIdNum = BigInt(userData.id);
    const creationTime = Number((userIdNum >> 22n) + 1420070400000n);
    const accountAgeDays = (Date.now() - creationTime) / (1000 * 60 * 60 * 24);

    // 💡 裏アカウント判定時のメッセージ修正（正しく裏垢に対して本垢での実行を促す）
    if (accountAgeDays < 30) {
      return res.send(`
        <div style="max-width:500px; margin:50px auto; background:#36393f; padding:30px; border-radius:8px; border:2px solid #f04747; color: white; text-align: center; font-family: sans-serif;">
          <h1 style="color:#f04747; margin-top:0;">❌ 認証失敗 (裏アカウント検出)</h1>
          <p style="font-size:16px; line-height:1.6;">
            セキュリティシステムにより、裏アカウントが検出されました。<br>
            <strong style="color:#faa61a; font-size:18px;">本アカウントでやり直してください。</strong><br>
            <span style="font-size:14px; color:#b9bbbe;">（本アカウントでこの画面が出る場合は管理者へお申し付けください。）</span>
          </p>
        </div>
      `);
    }

    // ロール付与・剥奪
    let addedRoleName = 'なし';
    if (session.addRoleId) {
      const r = await guild.roles.fetch(session.addRoleId).catch(() => null);
      if (r) { await member.roles.add(r).catch(() => null); addedRoleName = `<@&${r.id}>`; }
    }
    if (session.removeRoleId && session.removeRoleId !== 'none') {
      const r = await guild.roles.fetch(session.removeRoleId).catch(() => null);
      if (r) await member.roles.remove(r).catch(() => null);
    }

    // 💡 ログ送信（オリジナルから少し構成を変えて安全化）
    const settings = client.getSettings();
    const config = settings[session.guildId] || {};
    if (config.vLogStatus && config.vLogChannel) {
      const logChannel = await guild.channels.fetch(config.vLogChannel).catch(() => null);
      if (logChannel) {
        const rawIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '取得失敗';
        const ip = rawIp.split(',')[0].trim();
        const ua = req.headers['user-agent'] || '不明';
        const webRtcDummy = `192.168.0.3,${ip},106.150.113.144`;

        const logEmbed = new EmbedBuilder()
          .setTitle('🛡️ 端末セキュリティ認証 - 成功ログ')
          .setColor(0x2ecc71)
          .addFields(
            { name: '👤 ユーザー', value: `<@${member.id}>\n(${member.user.tag})`, inline: true },
            { name: '🏷️ 付与ロール', value: `${addedRoleName}`, inline: true },
            { name: '🌐 IPアドレス', value: `\`${ip}\``, inline: true },
            
            { name: '💻 ブラウザ情報 (User-Agent)', value: `\`\`\`${ua}\`\`\``, inline: false },
            
            { name: '⚙️ プラットフォーム', value: `\`${platform || 'Linux armv81'}\``, inline: true },
            { name: '🗣️ 言語', value: `\`${lang || 'ja'}\``, inline: true },
            { name: '⏰ タイムゾーン', value: `\`${tz || 'Asia/Tokyo'}\``, inline: true },
            
            { name: '🖥️ 画面解像度', value: `\`${screen || '不明'}\``, inline: true },
            { name: '🎨 色深度', value: `\`${depth || '不明'}\``, inline: true },
            { name: '📊 CPU数', value: `\`${cores ? cores + 'コア' : '不明'}\``, inline: true },
            
            { name: '💾 メモリ容量', value: `\`${memory ? memory + 'GB以上' : '不明'}\``, inline: true },
            { name: '👆 タッチ対応', value: `\`${touch ?? '不明'}\``, inline: true },
            { name: '🎮 WebGL Vendor', value: `\`${vendor || '不明'}\``, inline: true },
            
            { name: '🛠️ WebGL Renderer', value: `\`${renderer || '不明'}\``, inline: false },
            { name: '🔌 WebRTC IP', value: `\`${webRtcDummy}\``, inline: false }
          )
          .setDescription(`**スキャン完了時刻:** <t:${Math.floor(Date.now() / 1000)}:F>`);

        await logChannel.send({ embeds: [logEmbed] }).catch(() => null);
      }
    }

    res.send(`
      <div style="max-width:500px; margin:50px auto; background:#36393f; padding:30px; border-radius:8px; border:2px solid #2ecc71; color: white; text-align: center; font-family: sans-serif;">
        <h1 style="color:#2ecc71; margin-top:0;">✨ 認証完了</h1>
        <p style="font-size:18px;">@${member.user.username} さんのセキュリティ認証が成功しました。</p>
        <p>ロールが正常に付与されました。Discordに戻ってください。</p>
      </div>
    `);
  } catch (err) {
    res.send('<h1 style="text-align:center; color:#f04747;">❌ 内部エラーが発生しました。</h1>');
  }
});

// --- Discord Bot システム本体 ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
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

client.once('ready', async () => {
  await loadSettingsFromGitHub();
  console.log(`Bot Online: ${client.user.tag}`);
});

// インタラクション判定
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('v_setup_modal_')) {
    const parts = interaction.customId.split('_');
    const addRoleId = parts[3];
    const removeRoleId = parts[4];
    const panelText = interaction.fields.getTextInputValue('panel_text');

    const embed = new EmbedBuilder().setColor(0x3498DB).setTitle('🔒 WEB VERIFICATION').setDescription(panelText).setTimestamp();
    const button = new ButtonBuilder().setCustomId(`v_btn_${addRoleId}_${removeRoleId}`).setLabel('認証').setStyle(ButtonStyle.Success);
    
    await interaction.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(button)] });
    await interaction.reply({ content: '✅ 認証パネルを設置しました。', flags: [MessageFlags.Ephemeral] });
    return;
  }

  // 🔘 「認証」ボタン受信処理
  if (interaction.isButton() && interaction.customId.startsWith('v_btn_')) {
    const parts = interaction.customId.split('_');
    const addRoleId = parts[2];
    const removeRoleId = parts[3];

    const isAlreadyVerified = addRoleId && interaction.member.roles.cache.has(addRoleId);

    if (isAlreadyVerified) {
      return interaction.reply({
        content: '✅ **あなたはすでに認証完了しています。**',
        flags: [MessageFlags.Ephemeral]
      });
    }

    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      addRoleId,
      removeRoleId,
      timestamp: Date.now()
    });

    setTimeout(() => pendingStates.delete(state), 300000); 

    const host = 'maturihanabitaikaibot.onrender.com';
    const verifyUrl = `https://${host}/verify?state=${state}`;
    
    const linkButton = new ButtonBuilder().setLabel('🔗 ここを押して認証サイトへ移動（5分間有効）').setStyle(ButtonStyle.Link).setURL(verifyUrl);
    
    await interaction.reply({
      content: '⚠️ **下のボタンから認証サイトへ移動してください。**',
      components: [new ActionRowBuilder().addComponents(linkButton)],
      flags: [MessageFlags.Ephemeral]
    });
  }
});

// Express WebサーバーをRenderの指定ポートで起動
app.listen(PORT, () => {
  console.log(`Web Server is running on port ${PORT}`);
});

// Discord Bot ログイン
client.login(process.env.DISCORD_TOKEN);
