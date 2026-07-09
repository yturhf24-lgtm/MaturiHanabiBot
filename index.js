const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits, EmbedBuilder } = require('discord.js');
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
    GatewayIntentBits.GuildInvites // 💡 招待リンクを追跡するために必須のインテント
  ]
});

// 招待リンクのキャッシュ保持用
const invitesCache = new Map();

// --- GitHub API 経由のデータ管理設定 ---
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
      headers: {
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'Render-Discord-Bot',
        'Accept': 'application/vnd.github.v3+json'
      }
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
  } catch (err) {
    console.error('GitHubデータの読み込みエラー:', err.message);
  }
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

// --- コマンド自動読み込み ---
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

  // 起動時に全サーバーの招待リンクの初期状態をキャッシュに記憶する
  for (const [_, guild] of client.guilds.cache) {
    try {
      const guildInvites = await guild.invites.fetch();
      invitesCache.set(guild.id, new Map(guildInvites.map(invite => [invite.code, invite.uses])));
    } catch (err) {
      console.log(`サーバー [${guild.name}] の招待リンク取得をスキップしました(権限不足等)`);
    }
  }
});

// 招待リンクが作られた/消されたときにキャッシュを自動更新
client.on('inviteCreate', async (invite) => {
  const guildInvites = invitesCache.get(invite.guild.id) || new Map();
  guildInvites.set(invite.code, invite.uses);
  invitesCache.set(invite.guild.id, guildInvites);
});

// --- 📥 メンバー参加イベント ---
client.on('guildMemberAdd', async (member) => {
  const settings = client.getSettings();
  const config = settings[member.guild.id];
  const channelId = config?.logChannel;
  if (!channelId) return;

  try {
    const channel = await member.guild.channels.fetch(channelId);
    if (!channel) return;

    // どの招待リンクが使われたか特定する処理
    let usedInviteString = '不明、またはワンタイムリンク';
    try {
      const newInvites = await member.guild.invites.fetch();
      const oldInvites = invitesCache.get(member.guild.id);
      
      const usedInvite = newInvites.find(inv => oldInvites && inv.uses > (oldInvites.get(inv.code) || 0));
      if (usedInvite) {
        usedInviteString = `https://discord.gg/${usedInvite.code} (作成者: <@${usedInvite.inviter.id}> | 使用数: ${usedInvite.uses}回)`;
      }
      // キャッシュを最新に更新
      invitesCache.set(member.guild.id, new Map(newInvites.map(invite => [invite.code, invite.uses])));
    } catch (e) {
      console.log('招待リンクの特定に失敗しました。');
    }

    // メッセージのカスタム置換
    const rawTemplate = config.joinMessage || '**{user}** がサーバーに参加しました！';
    const finalDescription = rawTemplate.replace(/{user}/g, `<@${member.id}>`);

    // アカウント作成日を読みやすい表記に
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
  } catch (err) {
    console.error(err);
  }
});

// --- 📤 メンバー退出イベント ---
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
  } catch (err) {
    console.error(err);
  }
});

// --- スラッシュコマンド実行イベント ---
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    const errorEmbed = { description: 'コマンド実行時にエラーが発生しました。', color: 0xFF0000 };
    if (interaction.replied || interaction.deferred) await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
    else await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
