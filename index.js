const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, EmbedBuilder, MessageFlags } = require('discord.js');
const express = require('express');

// --- Render用 Webサーバー処理 ---
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Status: Online'));
app.listen(PORT, () => console.log(`HTTP Web Server listening on port ${PORT}`));

// --- Discord Bot 本体 ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites
  ]
});

const invitesCache = new Map();
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
    const response = await fetch(url, {
      headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Discord-Bot', 'Accept': 'application/vnd.github.v3+json' }
    });
    if (response.ok) {
      const json = await response.json();
      const content = Buffer.from(json.content, 'base64').toString('utf8');
      localSettingsCache = JSON.parse(content);
      fs.writeFileSync(DATA_FILE, JSON.stringify(localSettingsCache, null, 2));
    } else if (response.status === 404) {
      localSettingsCache = {};
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
    const getRes = await fetch(url, { headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Discord-Bot' } });
    if (getRes.ok) { const getJson = await getRes.json(); sha = getJson.sha; }
    const base64Content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
    await fetch(url, {
      method: 'PUT',
      headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Discord-Bot', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'chore: update data.json via API [skip ci]', content: base64Content, sha: sha })
    });
  } catch (err) { console.error(err.message); }
};

// コマンド読み込み
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) client.commands.set(command.data.name, command);
}

// 🚀 起動完了イベント (Deprecation警告対策・スパム通知除去)
client.once('clientReady', async () => {
  await loadSettingsFromGitHub();
  console.log(`Botがログインしました: ${client.user.tag}`);

  for (const [_, guild] of client.guilds.cache) {
    try {
      const guildInvites = await guild.invites.fetch();
      invitesCache.set(guild.id, new Map(guildInvites.map(invite => [invite.code, invite.uses])));
    } catch (e) {}
  }
  // 💡 バグだった起動時の自動通知スパムコードは完全に抹消しました。
});

// 招待キャッシュ更新用
client.on('inviteCreate', async (invite) => {
  const guildInvites = invitesCache.get(invite.guild.id) || new Map();
  guildInvites.set(invite.code, invite.uses);
  invitesCache.set(invite.guild.id, guildInvites);
});

// 💡 Webhookを取得または自動生成する関数（エラーログ＆権限警告強化版）
async function getOrCreateWebhook(channel) {
  try {
    const webhooks = await channel.fetchWebhooks();
    let webhook = webhooks.find(wh => wh.owner.id === client.user.id);
    if (!webhook) {
      webhook = await channel.createWebhook({
        name: 'SYSTEM LOG WEBHOOK',
        avatar: client.user.displayAvatarURL(),
        reason: '参加・退出ログ用自動生成WebHook'
      });
    }
    return webhook;
  } catch (err) {
    console.error('============ WEBHOOK ERROR ============');
    console.error(`チャンネル: ${channel.name} (ID: ${channel.id})`);
    console.error(`エラー内容: ${err.message}`);
    console.error('対策: Discordサーバー設定のロールでBotに「ウェブフックの管理」権限を与えてください。');
    console.error('=======================================');
    return null; // 失敗時はnullを返し、バックアップシステムへ移行
  }
}

// 📥 メンバー参加イベント（Webhook埋め込み形式 ＋ 権限不足時の自動通常メッセージバックアップ内蔵）
client.on('guildMemberAdd', async (member) => {
  const settings = client.getSettings();
  const config = settings[member.guild.id];
  const channelId = config?.logChannel;
  if (!channelId) return;

  try {
    const channel = await member.guild.channels.fetch(channelId);
    if (!channel) return;

    let inviteDetails = '不明、またはワンタイムリンク';
    let inviterUser = '判別不能';

    try {
      const newInvites = await member.guild.invites.fetch();
      const oldInvites = invitesCache.get(member.guild.id);
      const usedInvite = newInvites.find(inv => oldInvites && inv.uses > (oldInvites.get(inv.code) || 0));
      if (usedInvite) {
        inviteDetails = `https://discord.gg/${usedInvite.code} (使用数: ${usedInvite.uses}回)`;
        inviterUser = `<@${usedInvite.inviter.id}> (${usedInvite.inviter.tag})`;
      }
      invitesCache.set(member.guild.id, new Map(newInvites.map(invite => [invite.code, invite.uses])));
    } catch (e) {}

    const rawTemplate = config.joinMessage || '**{user}** がサーバーに参加しました！';
    const finalDescription = rawTemplate.replace(/{user}/g, `<@${member.id}>`);
    const createdAt = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F> (<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>)`;

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('📥 プレイヤーが入室しました')
      .setDescription(finalDescription)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 入ってきたプレイヤー', value: `<@${member.id}> (${member.user.tag})`, inline: true },
        { name: '📅 アカウント作成日', value: createdAt, inline: false },
        { name: '👤 招待した人', value: inviterUser, inline: true },
        { name: '🔗 使用された招待リンク', value: inviteDetails, inline: true }
      )
      .setTimestamp();

    const webhook = await getOrCreateWebhook(channel);
    if (webhook) {
      // ⭕ Webhook権限があればカスタムWebhookとしてかっこよく送信
      await webhook.send({
        embeds: [embed],
        username: 'SERVER ENTRY GATE',
        avatarURL: 'https://i.imgur.com/wSTFkRM.png'
      });
    } else {
      // ⚠️ Webhook権限がなければ、Botの通常メッセージとして埋め込みを安全にバックアップ送信
      await channel.send({ embeds: [embed] });
    }
  } catch (err) { console.error(err); }
});

// 📤 メンバー退出イベント（Webhook埋め込み形式 ＋ 通常メッセージバックアップ内蔵）
client.on('guildMemberRemove', async (member) => {
  const settings = client.getSettings();
  const config = settings[member.guild.id];
  const channelId = config?.logChannel;
  if (!channelId) return;

  try {
    const channel = await member.guild.channels.fetch(channelId);
    if (!channel) return;

    const rawTemplate = config.leaveMessage || '**{user}** がサーバーから退出しました。';
    const finalDescription = rawTemplate.replace(/{user}/g, `<@${member.id}>`);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('📤 プレイヤーが退室しました')
      .setDescription(finalDescription)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 退出プレイヤー', value: `<@${member.id}> (${member.user.tag})`, inline: true }
      )
      .setTimestamp();

    const webhook = await getOrCreateWebhook(channel);
    if (webhook) {
      await webhook.send({
        embeds: [embed],
        username: 'SERVER EXIT GATE',
        avatarURL: 'https://i.imgur.com/E761vIs.png'
      });
    } else {
      await channel.send({ embeds: [embed] });
    }
  } catch (err) { console.error(err); }
});

// インタラクション受信
client.on('interactionCreate', async interaction => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try { await command.execute(interaction); } catch (error) { console.error(error); }
    return;
  }

  if (interaction.isModalSubmit()) {
    const settings = client.getSettings();
    if (!settings[interaction.guildId]) settings[interaction.guildId] = { roles: [] };

    if (interaction.customId === 'join_msg_modal') {
      const updatedJoin = interaction.fields.getTextInputValue('modal_join_text_input');
      settings[interaction.guildId].logChannel = interaction.channelId; // 現在のチャンネルを自動保存
      settings[interaction.guildId].joinMessage = updatedJoin;
      await client.saveSettings(settings);

      await interaction.reply({
        content: `✅ **参加ログの設定を保存しました！**\n📺 **通知先**: <#${interaction.channelId}>\n📥 **オリジナル文字**:\n\`\`\`${updatedJoin}\`\`\``,
        flags: [MessageFlags.Ephemeral]
      });
    }

    if (interaction.customId === 'leave_msg_modal') {
      const updatedLeave = interaction.fields.getTextInputValue('modal_leave_text_input');
      settings[interaction.guildId].logChannel = interaction.channelId; // 現在のチャンネルを自動保存
      settings[interaction.guildId].leaveMessage = updatedLeave;
      await client.saveSettings(settings);

      await interaction.reply({
        content: `✅ **退出ログの設定を保存しました！**\n📺 **通知先**: <#${interaction.channelId}>\n📤 **オリジナル文字**:\n\`\`\`${updatedLeave}\`\`\``,
        flags: [MessageFlags.Ephemeral]
      });
    }
  }
});

// 💡 本当に終了する直前のみ1回だけ飛ぶ「再起動前・予告通知」
async function sendPreRebootNotification() {
  console.log('⚠️ 終了シグナルを受信しました。再起動前の事前通知を送信します...');
  const settings = localSettingsCache;
  for (const [guildId, config] of Object.entries(settings)) {
    if (config.rebootStatus && config.rebootChannel) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        const channel = await guild.channels.fetch(config.rebootChannel);
        if (!channel) continue;

        const embed = new EmbedBuilder()
          .setColor(0xFFAA00)
          .setTitle('⚠️ SYSTEM REBOOT INITIATED')
          .setDescription('プログラム更新のため、**これよりシステムの再起動を行います。**')
          .addFields(
            { name: '🔴 ステータス', value: '` 再起動の準備中 (GO OFFLINE) `', inline: true },
            { name: '⏱️ 復帰時間', value: '約 10秒 〜 30秒以内', inline: true }
          )
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      } catch (err) {}
    }
  }
}

process.on('SIGTERM', async () => { await sendPreRebootNotification(); process.exit(0); });
process.on('SIGINT', async () => { await sendPreRebootNotification(); process.exit(0); });

client.login(process.env.DISCORD_TOKEN);
