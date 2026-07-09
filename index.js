const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, EmbedBuilder, MessageFlags } = require('discord.js');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot Status: Online'));
app.listen(PORT, () => console.log(`HTTP Web Server listening on port ${PORT}`));

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
    console.log('GitHub APIから最新データを取得中...');
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `token ${process.env.GITHUB_TOKEN}`, 'User-Agent': 'Render-Discord-Bot', 'Accept': 'application/vnd.github.v3+json' }
    });
    if (response.ok) {
      const json = await response.json();
      const content = Buffer.from(json.content, 'base64').toString('utf8');
      localSettingsCache = JSON.parse(content);
      fs.writeFileSync(DATA_FILE, JSON.stringify(localSettingsCache, null, 2));
      console.log('GitHubからのデータ同期に成功しました！');
    } else if (response.status === 404) {
      console.log('GitHub上に data.json がまだありません。初回コマンド実行時に自動生成されます。');
      localSettingsCache = {};
    }
  } catch (err) { console.error('GitHubデータの読み込みエラー:', err.message); }
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
  } catch (err) { console.error('GitHubへの保存エラー:', err.message); }
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

// 🚀 起動完了イベント
client.once('ready', async () => {
  await loadSettingsFromGitHub();
  console.log(`Botがログインしました: ${client.user.tag}`);

  for (const [_, guild] of client.guilds.cache) {
    try {
      const guildInvites = await guild.invites.fetch();
      invitesCache.set(guild.id, new Map(guildInvites.map(invite => [invite.code, invite.uses])));
    } catch (e) {}
  }

  // 再起動完了通知（ON設定のサーバーのみ）
  const settings = client.getSettings();
  for (const [guildId, config] of Object.entries(settings)) {
    if (config.rebootStatus && config.rebootChannel) {
      try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) continue;
        const channel = await guild.channels.fetch(config.rebootChannel);
        if (!channel) continue;

        const embed = new EmbedBuilder()
          .setColor(0x00FFFF)
          .setTitle('⚡ SYSTEM REBOOT COMPLETE')
          .setDescription('Botのシステム再起動および同期処理が正常に完了しました。')
          .addFields(
            { name: '🟢 稼働ステータス', value: '` 正常稼働中 (ONLINE) `', inline: true },
            { name: '⏰ 起動時刻', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `${client.user.username} システムメインコア` });

        await channel.send({ embeds: [embed] });
      } catch (err) {}
    }
  }
});

// 招待リンクイベント
client.on('inviteCreate', async (invite) => {
  const guildInvites = invitesCache.get(invite.guild.id) || new Map();
  guildInvites.set(invite.code, invite.uses);
  invitesCache.set(invite.guild.id, guildInvites);
});

// 📥 メンバー参加イベント
client.on('guildMemberAdd', async (member) => {
  const settings = client.getSettings();
  const config = settings[member.guild.id];
  const channelId = config?.logChannel;
  if (!channelId) return;
  try {
    const channel = await member.guild.channels.fetch(channelId);
    if (!channel) return;
    let usedInviteString = '不明、またはワンタイムリンク';
    try {
      const newInvites = await member.guild.invites.fetch();
      const oldInvites = invitesCache.get(member.guild.id);
      const usedInvite = newInvites.find(inv => oldInvites && inv.uses > (oldInvites.get(inv.code) || 0));
      if (usedInvite) usedInviteString = `https://discord.gg/${usedInvite.code} (作成者: <@${usedInvite.inviter.id}> | 使用数: ${usedInvite.uses}回)`;
      invitesCache.set(member.guild.id, new Map(newInvites.map(invite => [invite.code, invite.uses])));
    } catch (e) {}
    const rawTemplate = config.joinMessage || '**{user}** がサーバーに参加しました！';
    const finalDescription = rawTemplate.replace(/{user}/g, `<@${member.id}>`);
    const createdAt = `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F> (<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>)`;
    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('📥 TARGET DETECTED: USER JOINED')
      .setDescription(finalDescription)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 ユーザー情報', value: `${member.user.tag} (ID: ${member.id})`, inline: false },
        { name: '📅 アカウント作成日', value: createdAt, inline: false },
        { name: '🔗 使用された招待リンク', value: usedInviteString, inline: false },
        { name: '📊 サーバー総人数', value: `現在のメンバー数: **${member.guild.memberCount}** 人`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: '👤 INTERFACE: USER_JOIN_MANAGER' });
    await channel.send({ embeds: [embed] });
  } catch (err) { console.error(err); }
});

// 📤 メンバー退出イベント
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
      .setTitle('📤 TARGET LOST: USER LEFT')
      .setDescription(finalDescription)
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '👤 ユーザー情報', value: `${member.user.tag} (ID: ${member.id})`, inline: false },
        { name: '📊 サーバー総人数', value: `現在のメンバー数: **${member.guild.memberCount}** 人`, inline: false }
      )
      .setTimestamp()
      .setFooter({ text: '👤 INTERFACE: USER_LEAVE_MANAGER' });
    await channel.send({ embeds: [embed] });
  } catch (err) { console.error(err); }
});

// 🎛️ インタラクション（コマンド＆UIボタン）受信イベント
client.on('interactionCreate', async interaction => {
  // 1. スラッシュコマンドの処理
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      const errorEmbed = { description: 'コマンド実行時にエラーが発生しました。', color: 0xFF0000 };
      if (interaction.replied || interaction.deferred) await interaction.followUp({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] });
      else await interaction.reply({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] });
    }
    return;
  }

  // 2. 画面UI上の「ボタン」が押されたときの処理
  if (interaction.isButton()) {
    const settings = client.getSettings();
    const config = settings[interaction.guildId] || {};

    if (interaction.customId === 'ui_test_join') {
      // 参加テスト送信処理
      const rawTemplate = config.joinMessage || '**{user}** がサーバーに参加しました！';
      const testDesc = rawTemplate.replace(/{user}/g, `<@${interaction.user.id}>`);
      const embed = new EmbedBuilder().setColor(0x00FF00).setTitle('📥 [TEST] USER JOINED').setDescription(testDesc + '\n\n*(これはボタン操作による動作テスト用ログ画面です)*').setThumbnail(interaction.user.displayAvatarURL());
      return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    if (interaction.customId === 'ui_test_leave') {
      // 退出テスト送信処理
      const rawTemplate = config.leaveMessage || '**{user}** がサーバーから退出しました。';
      const testDesc = rawTemplate.replace(/{user}/g, `<@${interaction.user.id}>`);
      const embed = new EmbedBuilder().setColor(0xFF0000).setTitle('📤 [TEST] USER LEFT').setDescription(testDesc + '\n\n*(これはボタン操作による動作テスト用ログ画面です)*').setThumbnail(interaction.user.displayAvatarURL());
      return interaction.reply({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
    }

    if (interaction.customId === 'ui_system_reset') {
      // 一括リセット処理
      settings[interaction.guildId] = { roles: settings[interaction.guildId]?.roles || [] };
      await client.saveSettings(settings);
      return interaction.reply({ content: '⚙️ ログシステムの設定をすべて一括初期化しました。再読み込みするにはもう一度 `/log-status` を実行してください。', flags: [MessageFlags.Ephemeral] });
    }
  }
});

// 💡 【新機能】サーバーがシャットダウン（再起動）される直前を検知して先んじて通知を投げる処理
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
          .setColor(0xFFAA00) // 警告のオレンジ色
          .setTitle('⚠️ SYSTEM REBOOT INITIATED')
          .setDescription('サーバーのメンテナンス、またはプログラム更新のため、**これよりシステムの再起動を行います。**')
          .addFields(
            { name: '🔴 現在のステータス', value: '` 再起動の準備中 (GO OFFLINE) `', inline: true },
            { name: '⏱️ 予想復帰時間', value: '約 10秒 〜 30秒以内', inline: true }
          )
          .setTimestamp()
          .setFooter({ text: `${client.user.username} 終了シーケンス` });

        await channel.send({ embeds: [embed] });
      } catch (err) {
        console.error('再起動前通知の送信に失敗:', err.message);
      }
    }
  }
}

// Renderなどからの終了指示シグナル（SIGTERM / SIGINT）をフックする
process.on('SIGTERM', async () => {
  await sendPreRebootNotification();
  process.exit(0);
});
process.on('SIGINT', async () => {
  await sendPreRebootNotification();
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
