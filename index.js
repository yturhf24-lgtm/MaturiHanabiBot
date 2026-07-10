const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const express = require('express');
const crypto = require('crypto');

// --- 認証用の一時状態キャッシュ ---
const pendingStates = new Map();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// 💡 認証用のフロントエンド画面UI (透かし表記なし・端末データ自動収集機能)
app.get('/verify', (req, res) => {
  const state = req.query.state;
  if (!state || !pendingStates.has(state)) {
    return res.status(400).send('<h1>❌ エラー: 無効なアクセス、またはURLの時間切れ(5分経過)です。</h1>');
  }
  
  const data = pendingStates.get(state);
  if (Date.now() - data.timestamp > 300000) { // 5分制限
    pendingStates.delete(state);
    return res.status(400).send('<h1>❌ 時間切れ: この認証リンクは5分の有効期限が切れています。もう一度Discordでボタンを押し直してください。</h1>');
  }

  // Discord認証（OAuth2）ページへリダイレクトするための処理
  const redirectUri = encodeURIComponent(`https://${req.get('host')}/callback`);
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=${state}`;
  
  res.redirect(discordAuthUrl);
});

// OAuth2コールバック＆端末情報送信用のHTMLページ
app.get('/callback', (req, res) => {
  const { code, state } = req.query;
  if (!state || !pendingStates.has(state)) return res.status(400).send('<h1>❌ 時間切れ、または無効なセッションです。</h1>');

  // ブラウザ側のJavaScriptを使って、解像度やWebRTC IPなどの詳細情報を引っこ抜いてサーバーに送信させるHTML
  res.send(`
    <!DOCTYPE html>
    <html lang="ja">
    <head>
        <meta charset="UTF-8">
        <title>認証処理中</title>
        <style>body { font-family: sans-serif; background: #2f3136; color: white; text-align: center; padding-top: 50px; }</style>
    </head>
    <body>
        <h2>🔒 端末セキュリティ認証を完了させています...</h2>
        <p>画面を閉じずに少々お待ちください。</p>
        <script>
            async function collect() {
                let rtcIp = "取得不可";
                try {
                    const pc = new RTCPeerConnection({iceServers:[]});
                    pc.createDataChannel("");
                    await pc.setLocalDescription(await pc.createOffer());
                    const match = pc.localDescription.sdp.match(/(?:[0-9]{1,3}\\.){3}[0-9]{1,3}|[a-f0-9:]+:[a-f0-9:]+/i);
                    if(match) rtcIp = match[0];
                } catch(e){}

                let gl, vendor = "不明", renderer = "不明";
                try {
                    const canvas = document.createElement('canvas');
                    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                    if(gl) {
                        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                        vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                        renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    }
                }catch(e){}

                const payload = {
                    code: "${code}",
                    state: "${state}",
                    screen: window.screen.width + "x" + window.screen.height,
                    depth: window.screen.colorDepth + "bit",
                    cores: navigator.hardwareConcurrency || "不明",
                    memory: navigator.deviceMemory ? navigator.deviceMemory + "GB" : "不明",
                    touch: ('ontouchstart' in window || navigator.maxTouchPoints > 0),
                    lang: navigator.language,
                    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    vendor: vendor,
                    renderer: renderer,
                    rtcIp: rtcIp
                };

                const res = await fetch('/submit-auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const text = await res.text();
                document.body.innerHTML = text;
            }
            window.onload = collect;
        </script>
    </body>
    </html>
  `);
});

// 端末情報とDiscordコードの受け取り・ロール付与・画像通りのログ出力
app.post('/submit-auth', async (req, res) => {
  const { code, state, screen, depth, cores, memory, touch, lang, tz, vendor, renderer, rtcIp } = req.body;
  if (!state || !pendingStates.has(state)) return res.send('<h1>❌ セッションが無効化されました。</h1>');

  const session = pendingStates.get(state);
  pendingStates.delete(state);

  if (Date.now() - session.timestamp > 300000) {
    return res.send('<h1>❌ セッションが5分を超えたため時間切れです。</h1>');
  }

  try {
    // Discordからアクセストークンを取得
    const redirectUri = `https://${req.get('host')}/callback`;
    const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (!tokenResponse.ok) return res.send('<h1>❌ Discordでのトークン認証に失敗しました。</h1>');
    const tokenData = await tokenResponse.json();

    // ユーザー情報の取得
    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();

    const guild = await client.guilds.fetch(session.guildId);
    const member = await guild.members.fetch(session.userId).catch(() => null);

    if (!member) return res.send('<h1>❌ あなたが対象のDiscordサーバー内に見つかりません。</h1>');

    // 💡 権限確認: ロール付与・削除を実行するBot自身の権限確認
    const botMember = await guild.members.fetch(client.user.id);
    if (!botMember.permissions.has('ManageRoles')) {
      return res.send('<h1>❌ 権限不足: Botに「ロールの管理」権限が付与されていないため、処理を中断しました。</h1>');
    }

    // ロール操作
    let addedRoleName = 'なし';
    if (session.addRoleId) {
      const r = await guild.roles.fetch(session.addRoleId);
      if (r) { await member.roles.add(r); addedRoleName = `<@&${r.id}>`; }
    }
    if (session.removeRoleId && session.removeRoleId !== 'none') {
      const r = await guild.roles.fetch(session.removeRoleId);
      if (r) await member.roles.remove(r);
    }

    // 💡 📋 画像通りの詳細ログ出力処理
    const settings = client.getSettings();
    const config = settings[session.guildId] || {};
    if (config.vLogStatus && config.vLogChannel) {
      const logChannel = await guild.channels.fetch(config.vLogChannel).catch(() => null);
      if (logChannel) {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '取得失敗';
        const ua = req.headers['user-agent'] || '不明';
        const platform = ua.match(/\\(([^)]+)\\)/)?.[1] || '不明';

        const embed = new EmbedBuilder()
          .setColor(0x2ECC71)
          .setTitle('✅ 認証成功 - 詳細ログ')
          .addFields(
            { name: 'ユーザー', value: `<@${member.id}> (${member.user.tag})`, inline: true },
            { name: '付与ロール', value: addedRoleName, inline: true },
            { name: 'IPアドレス', value: `\`${ip}\``, inline: true },
            { name: 'ブラウザ', value: `\`\`\`${ua}\`\`\``, inline: false },
            { name: 'プラットフォーム', value: `\`${platform}\``, inline: true },
            { name: '言語', value: `\`${lang}\``, inline: true },
            { name: 'タイムゾーン', value: `\`${tz}\``, inline: true },
            { name: '画面解像度', value: `\`${screen}\``, inline: true },
            { name: '色深度', value: `\`${depth}\``, inline: true },
            { name: 'CPU数', value: `\`${cores}コア\``, inline: true },
            { name: 'メモリ', value: `\`${memory}\``, inline: true },
            { name: 'タッチ対応', value: `\`${touch}\``, inline: true },
            { name: 'WebGL Vendor', value: `\`${vendor}\``, inline: true },
            { name: 'WebGL Renderer', value: `\`${renderer}\``, inline: false },
            { name: 'WebRTC IP', value: `\`${rtcIp || ip}\``, inline: false }
          )
          .setTimestamp();

        await logChannel.send({ embeds: [embed] });
      }
    }

    // ユーザーに返す最終完了画面 (クレジットなしの完全オリジナル)
    res.send(`
      <div style="max-width:500px; margin:50px auto; background:#36393f; padding:30px; border-radius:8px; border:2px solid #2ecc71;">
        <h1 style="color:#2ecc71; margin-top:0;">✨ 認証成功</h1>
        <p style="font-size:18px;">@${member.user.username} さんの認証に成功しました。</p>
        <p>ロールが正常に更新されました。この画面を閉じて Discord に戻ってください。</p>
      </div>
    `);

  } catch (err) {
    console.error(err);
    res.send('<h1>❌ 内部エラーが発生しました。</h1>');
  }
});

app.listen(PORT, () => console.log(`HTTP Server listening on port ${PORT}`));

// --- Discord Bot コア部 ---
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

client.once('clientReady', async () => {
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

  // 🔒 モーダル送信時 (管理者が案内文章を決定した瞬間)
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

  // 🔘 一般メンバーが「認証」ボタンを押した瞬間
  if (interaction.isButton() && interaction.customId.startsWith('v_btn_')) {
    const parts = interaction.customId.split('_');
    const addRoleId = parts[2];
    const removeRoleId = parts[3];

    // ランダムなセッションKey（state）を作って5分間の有効期限を設定
    const state = crypto.randomBytes(16).toString('hex');
    pendingStates.set(state, {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      addRoleId,
      removeRoleId,
      timestamp: Date.now()
    });

    // 5分後に自動で消去（時間切れ処理）
    setTimeout(() => pendingStates.delete(state), 300000);

    const verifyUrl = `https://${interaction.request.headers.host || 'maturihanabitaikaibot.onrender.com'}/verify?state=${state}`;
    const linkButton = new ButtonBuilder().setLabel('🔗 ここを押して認証サイトへ移動').setStyle(ButtonStyle.Link).setURL(verifyUrl);

    // 💡 自分だけ表示（シークレット）でURL付きボタンを返す
    await interaction.reply({
      content: '⚠️ **5分以内に下のボタンから認証を完了させてください。**\n(5分経過するとリンクは無効化されます)',
      components: [new ActionRowBuilder().addComponents(linkButton)],
      flags: [MessageFlags.Ephemeral]
    });
  }
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
client.login(process.env.DISCORD_TOKEN);
