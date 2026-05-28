```js
const express = require('express');
const fs = require('fs');

const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} = require('discord.js');

// ===============================
// Express
// ===============================

const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('BOT ONLINE');
});

app.listen(PORT, () => {
  console.log(`🌐 Web Server 起動: ${PORT}`);
});

// ===============================
// Discord Client
// ===============================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===============================
// TOKEN
// ===============================

const TOKEN = 'MTM1MzM5MzE5NDQxNDYzNzE5OA.GXgtZG.SDW89nKd9GSYjsBh7BJgMDPy_jTbTG-n_pM56Y';

// ===============================
// 保存ファイル
// ===============================

const SETTINGS_FILE = './settings.json';

// ===============================
// 設定
// ===============================

let settings = {
  monitorEnabled: true,
  alertChannelId: null,
  linkAlertEnabled: true,
  newAccountAlertEnabled: true,
  allowedRoleIds: [],
  panelDescription: 'ここに説明を書いてください',
  panelButtonLabel: '開く'
};

// ===============================
// 設定ロード
// ===============================

if (fs.existsSync(SETTINGS_FILE)) {

  try {

    const data =
      fs.readFileSync(
        SETTINGS_FILE,
        'utf8'
      );

    settings = JSON.parse(data);

    console.log('✅ 設定ロード完了');

  } catch (err) {

    console.log('❌ 設定ロード失敗');

  }

}

// ===============================
// 保存
// ===============================

function saveSettings() {

  try {

    fs.writeFileSync(
      SETTINGS_FILE,
      JSON.stringify(settings, null, 2)
    );

    console.log('✅ 設定保存完了');

  } catch (err) {

    console.log('❌ 設定保存失敗');
    console.error(err);

  }

}

// ===============================
// 起動
// ===============================

client.once('ready', async () => {

  console.log(
    `✅ ${client.user.tag} 起動完了`
  );

  const commands = [

    // ===============================
    // 監視
    // ===============================

    new SlashCommandBuilder()
      .setName('監視')
      .setDescription('監視ON/OFF')
      .addBooleanOption(option =>
        option
          .setName('状態')
          .setDescription('ON/OFF')
          .setRequired(true)
      ),

    // ===============================
    // アラートチャンネル
    // ===============================

    new SlashCommandBuilder()
      .setName('アラートチャンネル')
      .setDescription(
        'アラート送信先設定'
      )
      .addChannelOption(option =>
        option
          .setName('チャンネル')
          .setDescription('送信先')
          .addChannelTypes(
            ChannelType.GuildText
          )
          .setRequired(true)
      ),

    // ===============================
    // リンクアラート
    // ===============================

    new SlashCommandBuilder()
      .setName('リンクアラート')
      .setDescription(
        'リンク監視ON/OFF'
      )
      .addBooleanOption(option =>
        option
          .setName('状態')
          .setDescription('ON/OFF')
          .setRequired(true)
      ),

    // ===============================
    // 新規アカウントアラート
    // ===============================

    new SlashCommandBuilder()
      .setName(
        '新規アカウントアラート'
      )
      .setDescription(
        '10日以内アカウント監視'
      )
      .addBooleanOption(option =>
        option
          .setName('状態')
          .setDescription('ON/OFF')
          .setRequired(true)
      ),

    // ===============================
    // 設定確認
    // ===============================

    new SlashCommandBuilder()
      .setName('設定確認')
      .setDescription(
        '現在の設定確認'
      ),

    // ===============================
    // サーバー情報
    // ===============================

    new SlashCommandBuilder()
      .setName('サーバー情報')
      .setDescription(
        'サーバー情報表示'
      ),

    // ===============================
    // コマンド権限許可
    // ===============================

    new SlashCommandBuilder()
      .setName('コマンド権限許可')
      .setDescription(
        '使用可能ロール追加'
      )
      .addRoleOption(option =>
        option
          .setName('ロール')
          .setDescription(
            '許可するロール'
          )
          .setRequired(true)
      ),

    // ===============================
    // コマンド権限剥奪
    // ===============================

    new SlashCommandBuilder()
      .setName('コマンド権限剥奪')
      .setDescription(
        '使用可能ロール削除'
      )
      .addRoleOption(option =>
        option
          .setName('ロール')
          .setDescription(
            '削除するロール'
          )
          .setRequired(true)
      ),

    // ===============================
    // パネル設定
    // ===============================

    new SlashCommandBuilder()
      .setName('パネル設定')
      .setDescription(
        '説明とボタン設定'
      ),

    // ===============================
    // パネル
    // ===============================

    new SlashCommandBuilder()
      .setName('パネル')
      .setDescription(
        'パネル送信'
      )

  ].map(command => command.toJSON());

  await client.application.commands.set(
    commands
  );

  console.log(
    '✅ Slash Commands 登録完了'
  );

});

// ===============================
// Interaction
// ===============================

client.on(
  'interactionCreate',
  async interaction => {

    // ===============================
    // Modal
    // ===============================

    if (interaction.isModalSubmit()) {

      if (
        interaction.customId ===
        'panel_modal'
      ) {

        settings.panelDescription =
          interaction.fields.getTextInputValue(
            'panel_description'
          );

        settings.panelButtonLabel =
          interaction.fields.getTextInputValue(
            'panel_button'
          );

        saveSettings();

        return interaction.reply({
          content:
`✅ パネル設定保存完了`,
          flags:
            MessageFlags.Ephemeral
        });

      }

    }

    // ===============================
    // Button
    // ===============================

    if (interaction.isButton()) {

      if (
        interaction.customId ===
        'open_ticket'
      ) {

        return interaction.reply({
          content:
`✅ ボタンが押されました`,
          flags:
            MessageFlags.Ephemeral
        });

      }

    }

    // ===============================
    // Slash Command以外無視
    // ===============================

    if (
      !interaction.isChatInputCommand()
    ) return;

    const guild = interaction.guild;

    // ===============================
    // Owner
    // ===============================

    const isOwner =
      interaction.user.id ===
      guild.ownerId;

    // ===============================
    // Role Check
    // ===============================

    const hasAllowedRole =
      interaction.member.roles.cache.some(
        role =>
          settings.allowedRoleIds.includes(
            role.id
          )
      );

    // ===============================
    // 権限チェック
    // ===============================

    if (
      !isOwner &&
      !hasAllowedRole &&
      interaction.commandName !==
        'コマンド権限許可' &&
      interaction.commandName !==
        'コマンド権限剥奪'
    ) {

      return interaction.reply({
        content: '❌ 権限なし',
        flags:
          MessageFlags.Ephemeral
      });

    }

    // ===============================
    // コマンド権限許可
    // ===============================

    if (
      interaction.commandName ===
      'コマンド権限許可'
    ) {

      if (!isOwner) {

        return interaction.reply({
          content:
            '❌ サーバー所有者限定',
          flags:
            MessageFlags.Ephemeral
        });

      }

      const role =
        interaction.options.getRole(
          'ロール'
        );

      if (
        !settings.allowedRoleIds.includes(
          role.id
        )
      ) {

        settings.allowedRoleIds.push(
          role.id
        );

        saveSettings();

      }

      return interaction.reply({
        content:
`✅ ${role} を許可しました`,
        flags:
          MessageFlags.Ephemeral
      });

    }

    // ===============================
    // コマンド権限剥奪
    // ===============================

    if (
      interaction.commandName ===
      'コマンド権限剥奪'
    ) {

      if (!isOwner) {

        return interaction.reply({
          content:
            '❌ サーバー所有者限定',
          flags:
            MessageFlags.Ephemeral
        });

      }

      const role =
        interaction.options.getRole(
          'ロール'
        );

      settings.allowedRoleIds =
        settings.allowedRoleIds.filter(
          id => id !== role.id
        );

      saveSettings();

      return interaction.reply({
        content:
`✅ ${role} の権限を剥奪`,
        flags:
          MessageFlags.Ephemeral
      });

    }

    // ===============================
    // 監視
    // ===============================

    if (
      interaction.commandName ===
      '監視'
    ) {

      settings.monitorEnabled =
        interaction.options.getBoolean(
          '状態'
        );

      saveSettings();

      return interaction.reply({
        content:
`✅ 監視:
${
settings.monitorEnabled
? 'ON'
: 'OFF'
}`,
        flags:
          MessageFlags.Ephemeral
      });

    }

    // ===============================
    // アラートチャンネル
    // ===============================

    if (
      interaction.commandName ===
      'アラートチャンネル'
    ) {

      const channel =
        interaction.options.getChannel(
          'チャンネル'
        );

      settings.alertChannelId =
        channel.id;

      saveSettings();

      return interaction.reply({
        content:
`✅ アラートチャンネル設定:
${channel}`,
        flags:
          MessageFlags.Ephemeral
      });

    }

    // ===============================
    // リンクアラート
    // ===============================

    if (
      interaction.commandName ===
      'リンクアラート'
    ) {

      settings.linkAlertEnabled =
        interaction.options.getBoolean(
          '状態'
        );

      saveSettings();

      return interaction.reply({
        content:
`✅ リンク監視:
${
settings.linkAlertEnabled
? 'ON'
: 'OFF'
}`,
        flags:
          MessageFlags.Ephemeral
      });

    }

    // ===============================
    // 新規アカウントアラート
    // ===============================

    if (
      interaction.commandName ===
      '新規アカウントアラート'
    ) {

      settings.newAccountAlertEnabled =
        interaction.options.getBoolean(
          '状態'
        );

      saveSettings();

      return interaction.reply({
        content:
`✅ 新規アカウント監視:
${
settings.newAccountAlertEnabled
? 'ON'
: 'OFF'
}`,
        flags:
          MessageFlags.Ephemeral
      });

    }

    // ===============================
    // 設定確認
    // ===============================

    if (
      interaction.commandName ===
      '設定確認'
    ) {

      return interaction.reply({
        content:
`⚙ 現在の設定

👁 監視:
${
settings.monitorEnabled
? 'ON'
: 'OFF'
}

🔗 リンク監視:
${
settings.linkAlertEnabled
? 'ON'
: 'OFF'
}

🆕 新規アカウント監視:
${
settings.newAccountAlertEnabled
? 'ON'
: 'OFF'
}

📢 アラートチャンネル:
${
settings.alertChannelId
? `<#${settings.alertChannelId}>`
: '未設定'
}

🎭 権限ロール数:
${settings.allowedRoleIds.length}`,
        flags:
          MessageFlags.Ephemeral
      });

    }

    // ===============================
    // サーバー情報
    // ===============================

    if (
      interaction.commandName ===
      'サーバー情報'
    ) {

      const members =
        guild.members.cache;

      const botCount =
        members.filter(
          member =>
            member.user.bot
        ).size;

      const userCount =
        members.filter(
          member =>
            !member.user.bot
        ).size;

      return interaction.reply({
        content:
`📊 サーバー情報

👑 サーバー名:
${guild.name}

👥 合計人数:
${guild.memberCount}

🙂 一般ユーザー:
${userCount}

🤖 BOT:
${botCount}

📝 チャンネル数:
${guild.channels.cache.size}

🎭 ロール数:
${guild.roles.cache.size}`,
        flags:
          MessageFlags.Ephemeral
      });

    }

    // ===============================
    // パネル設定
    // ===============================

    if (
      interaction.commandName ===
      'パネル設定'
    ) {

      const modal =
        new ModalBuilder()
          .setCustomId(
            'panel_modal'
          )
          .setTitle('パネル設定');

      const descriptionInput =
        new TextInputBuilder()
          .setCustomId(
            'panel_description'
          )
          .setLabel('説明')
          .setStyle(
            TextInputStyle.Paragraph
          )
          .setRequired(true)
          .setValue(
            settings.panelDescription
          );

      const buttonInput =
        new TextInputBuilder()
          .setCustomId(
            'panel_button'
          )
          .setLabel('ボタン名')
          .setStyle(
            TextInputStyle.Short
          )
          .setRequired(true)
          .setValue(
            settings.panelButtonLabel
          );

      const row1 =
        new ActionRowBuilder()
          .addComponents(
            descriptionInput
          );

      const row2 =
        new ActionRowBuilder()
          .addComponents(
            buttonInput
          );

      modal.addComponents(
        row1,
        row2
      );

      return interaction.showModal(
        modal
      );

    }

    // ===============================
    // パネル
    // ===============================

    if (
      interaction.commandName ===
      'パネル'
    ) {

      const embed =
        new EmbedBuilder()
          .setTitle(
            'サポートパネル'
          )
          .setDescription(
            settings.panelDescription
          )
          .setColor('Blue');

      const row =
        new ActionRowBuilder()
          .addComponents(

            new ButtonBuilder()
              .setCustomId(
                'open_ticket'
              )
              .setLabel(
                settings.panelButtonLabel
              )
              .setStyle(
                ButtonStyle.Success
              )

          );

      return interaction.reply({
        embeds: [embed],
        components: [row]
      });

    }

  }
);

// ===============================
// Message Monitor
// ===============================

client.on(
  'messageCreate',
  async message => {

    if (message.author.bot)
      return;

    if (
      !settings.monitorEnabled
    ) return;

    // ===============================
    // リンク検知
    // ===============================

    if (
      settings.linkAlertEnabled &&
      /(https?:\/\/[^\s]+)/g.test(
        message.content
      )
    ) {

      if (
        settings.alertChannelId
      ) {

        const channel =
          message.guild.channels.cache.get(
            settings.alertChannelId
          );

        if (channel) {

          channel.send(
`🚨 リンク検知

👤 ${message.author.tag}
📍 ${message.channel}

${message.content}`
          );

        }

      }

    }

  }
);

// ===============================
// 新規アカウント検知
// ===============================

client.on(
  'guildMemberAdd',
  async member => {

    if (
      !settings.newAccountAlertEnabled
    ) return;

    if (
      !settings.alertChannelId
    ) return;

    const accountAge =
      Date.now() -
      member.user.createdTimestamp;

    const days = Math.floor(
      accountAge /
      (1000 * 60 * 60 * 24)
    );

    if (days <= 10) {

      const channel =
        member.guild.channels.cache.get(
          settings.alertChannelId
        );

      if (channel) {

        channel.send(
`🚨 新規アカウント検知

👤 ${member.user.tag}
📅 作成日数: ${days}日
🆔 ${member.id}`
        );

      }

    }

  }
);

// ===============================
// Login
// ===============================

client.login(TOKEN);
```
