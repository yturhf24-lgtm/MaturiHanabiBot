const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, Collection, EmbedBuilder, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

// --- Express サーバー設定 ---
const app = express();
const port = process.env.PORT || 4000;

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

// --- GitHub 直接自動保存処理 ---
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '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';
const OWNER = 'yturhf24-lgtm';
const REPO = '-bot';
const BRANCH = 'main';

const configPath = path.join(__dirname, 'config.json');

async function saveConfigToGithub() {
  if (!fs.existsSync(configPath)) return;

  const content = fs.readFileSync(configPath, 'utf8');
  const base64Content = Buffer.from(content).toString('base64');
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/config.json`;

  let sha = null;
  try {
    const res = await fetch(`${url}?ref=${BRANCH}`, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'Node.js'
      }
    });
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch (e) {}

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Node.js'
      },
      body: JSON.stringify({
        message: 'Update config.json directly via bot',
        content: base64Content,
        branch: BRANCH,
        ...(sha ? { sha } : {})
      })
    });

    if (response.ok) {
      console.log('✅ GitHubリポジトリへ config.json を直接保存しました。');
    } else {
      const errData = await response.json();
      console.error('❌ GitHubへの直接保存失敗:', errData);
    }
  } catch (err) {
    console.error('❌ GitHub保存エラー:', err);
  }
}

// --- Discord Bot 設定 ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences
  ]
});

client.commands = new Collection();

function loadConfig() {
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    return {};
  }
}

// 唯一のコマンド (panel.js) を個別読み込み
const commandPath = path.join(__dirname, 'commands/panel.js');
const command = require(commandPath);
client.commands.set(command.data.name, command);
const commandsArray = [command.data.toJSON()];

// 共通ロール処理関数
async function processMemberRoles(member, guildConfig, isAutoCheck = false) {
  const { conditionRoleId, removeRoleIds = [], addRoleIds = [], logChannelId } = guildConfig;
  if (!conditionRoleId) return false;

  // 条件ロールを保有している場合のみ処理
  if (!member.roles.cache.has(conditionRoleId)) return false;

  const rolesToRemove = removeRoleIds.filter(id => member.roles.cache.has(id));
  const rolesToAdd = addRoleIds.filter(id => !member.roles.cache.has(id));

  if (rolesToRemove.length === 0 && rolesToAdd.length === 0) return false;

  for (const id of rolesToRemove) {
    try { await member.roles.remove(id); } catch (e) { console.error(`Role remove error: ${id}`, e); }
  }

  for (const id of rolesToAdd) {
    try { await member.roles.add(id); } catch (e) { console.error(`Role add error: ${id}`, e); }
  }

  if (logChannelId) {
    const logChannel = member.guild.channels.cache.get(logChannelId);
    if (logChannel) {
      const removedText = rolesToRemove.length > 0 ? rolesToRemove.map(id => `<@&${id}>`).join(', ') : 'なし';
      const addedText = rolesToAdd.length > 0 ? rolesToAdd.map(id => `<@&${id}>`).join(', ') : 'なし';

      const embed = new EmbedBuilder()
        .setTitle(isAutoCheck ? '🔄 オンライン復帰時自動ロール更新' : '⚙️ パネル手動更新実行')
        .setColor(0x00ff00)
        .addFields(
          { name: '対象ユーザー', value: `${member.user.tag} (<@${member.id}>)` },
          { name: '条件ロール', value: `<@&${conditionRoleId}>` },
          { name: '削除ロール', value: removedText },
          { name: '追加ロール', value: addedText }
        )
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  return true;
}

// clientReady イベントリスナー
client.once(Events.ClientReady, async (c) => {
  console.log(`Bot logged in as ${c.user.tag}`);

  // スラッシュコマンド（/panel）の登録
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(c.user.id), { body: commandsArray });
    console.log('/panel コマンドの登録完了');
  } catch (e) {
    console.error('コマンド登録エラー:', e);
  }

  // オンライン復帰時のロール自動チェック
  console.log('オンライン復帰時のメンバーロールスキャンを開始...');
  const allConfigs = loadConfig();

  for (const guild of client.guilds.cache.values()) {
    const guildConfig = allConfigs[guild.id];
    if (!guildConfig || !guildConfig.conditionRoleId) continue;

    try {
      const members = await guild.members.fetch();
      for (const member of members.values()) {
        if (!member.user.bot) {
          await processMemberRoles(member, guildConfig, true);
        }
      }
    } catch (err) {
      console.error(`Guild member fetch error (${guild.id}):`, err);
    }
  }
  console.log('オンライン復帰時ロールチェック完了');
});

// インタラクション処理
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel') {
    const cmd = client.commands.get('panel');
    if (cmd) await cmd.execute(interaction, saveConfigToGithub);
  }

  if (interaction.isButton() && interaction.customId === 'process_roles_button') {
    if (interaction.guild.ownerId !== interaction.user.id) {
      return interaction.reply({ content: '❌ この操作はサーバー所有者限定です。', ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const allConfigs = loadConfig();
    const guildConfig = allConfigs[interaction.guildId];

    if (!guildConfig || !guildConfig.conditionRoleId) {
      return interaction.editReply({ content: '⚠️ サーバー設定が見つかりません。先に `/panel` コマンドで設定を作成してください。' });
    }

    const updated = await processMemberRoles(interaction.member, guildConfig, false);

    if (updated) {
      await interaction.editReply({ content: '✅ ロールの更新処理が正常に完了しました。' });
    } else {
      await interaction.editReply({ content: 'ℹ️ 条件ロールを未所有か、更新対象のロールがありませんでした。' });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
