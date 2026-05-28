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
  PermissionsBitField
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
  console.log(`Web Server Start : ${PORT}`);
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

const TOKEN = process.env.TOKEN;

if (!TOKEN) {

  console.log('TOKEN が設定されていません');
  process.exit(1);

}

// ===============================
// Settings File
// ===============================

const SETTINGS_FILE = './settings.json';

// ===============================
// Default Settings
// ===============================

const defaultSettings = {

  monitorEnabled: true,

  linkAlertEnabled: true,

  newAccountAlertEnabled: true,

  alertChannelId: null,

  allowedRoleIds: [],

  panelDescription:
    'ここに説明を書いてください',

  panelButtonLabel:
    '開く'

};

// ===============================
// Settings
// ===============================

let settings = defaultSettings;

// ===============================
// Load Settings
// ===============================

function loadSettings() {

  try {

    if (!fs.existsSync(SETTINGS_FILE)) {

      fs.writeFileSync(

        SETTINGS_FILE,

        JSON.stringify(
          defaultSettings,
          null,
          2
        )

      );

      settings = defaultSettings;

      console.log('settings.json 作成');

      return;

    }

    const data = fs.readFileSync(
      SETTINGS_FILE,
      'utf8'
    );

    settings = JSON.parse(data);

    console.log('Settings Loaded');

  } catch (err) {

    console.error(
      'Settings Load Error',
      err
    );

    settings = defaultSettings;

  }

}

loadSettings();

// ===============================
// Save Settings
// ===============================

function saveSettings() {

  try {

    fs.writeFileSync(

      SETTINGS_FILE,

      JSON.stringify(
        settings,
        null,
        2
      )

    );

    console.log('Settings Saved');

  } catch (err) {

    console.error(
      'Settings Save Error',
      err
    );

  }

}

// ===============================
// Ready
// ===============================

client.once('ready', async () => {

  console.log(
    `${client.user.tag} Ready`
  );

  const commands = [

    // ===============================
    // 監視
    // ===============================

    new SlashCommandBuilder()

      .setName('監視')

      .setDescription(
        '監視 ON/OFF'
      )

      .addBooleanOption(option =>

        option

          .setName('状態')

          .setDescription(
            'ON / OFF'
          )

          .setRequired(true)

      ),

    // ===============================
    // アラートチャンネル
    // ===============================

    new SlashCommandBuilder()

      .setName(
        'アラートチャンネル'
      )

      .setDescription(
        '通知チャンネル設定'
      )

      .addChannelOption(option =>

        option

          .setName(
            'チャンネル'
          )

          .setDescription(
            '通知先'
          )

          .addChannelTypes(
            ChannelType.GuildText
          )

          .setRequired(true)

      ),

    // ===============================
    // リンクアラート
    // ===============================

    new SlashCommandBuilder()

      .setName(
        'リンクアラート'
      )

      .setDescription(
        'リンク監視 ON/OFF'
      )

      .addBooleanOption(option =>

        option

          .setName('状態')

          .setDescription(
            'ON / OFF'
          )

          .setRequired(true)

      ),

    // ===============================
    // 新規アカウント
    // ===============================

    new SlashCommandBuilder()

      .setName(
        '新規アカウントアラート'
      )

      .setDescription(
        '新規アカウント監視'
      )

      .addBooleanOption(option =>

        option

          .setName('状態')

          .setDescription(
            'ON / OFF'
          )

          .setRequired(true)

      ),

    // ===============================
    // 設定確認
    // ===============================

    new SlashCommandBuilder()

      .setName(
        '設定確認'
      )

      .setDescription(
        '現在の設定確認'
      ),

    // ===============================
    // サーバー情報
    // ===============================

    new SlashCommandBuilder()

      .setName(
        'サーバー情報'
      )

      .setDescription(
        'サーバー情報'
      ),

    // ===============================
    // 権限追加
    // ===============================

    new SlashCommandBuilder()

      .setName(
        'コマンド権限許可'
      )

      .setDescription(
        'コマンド使用許可'
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
    // 権限削除
    // ===============================

    new SlashCommandBuilder()

      .setName(
        'コマンド権限剥奪'
      )

      .setDescription(
        'コマンド権限削除'
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

      .setName(
        'パネル設定'
      )

      .setDescription(
        'パネル設定'
      ),

    // ===============================
    // パネル送信
    // ===============================

    new SlashCommandBuilder()

      .setName(
        'パネル'
      )

      .setDescription(
        'パネル送信'
      )

  ].map(command =>
    command.toJSON()
  );

  await client.application.commands.set(
    commands
  );

  console.log(
    'Slash Commands Loaded'
  );

});

// ===============================
// 権限チェック
// ===============================

function hasPermission(
  interaction
) {

  const guild =
    interaction.guild;

  const isOwner =
    interaction.user.id ===
    guild.ownerId;

  const isAdmin =
    interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    );

  const hasRole =
    interaction.member.roles.cache.some(
      role =>
        settings.allowedRoleIds.includes(
          role.id
        )
    );

  return (
    isOwner ||
    isAdmin ||
    hasRole
  );

}

// ===============================
// Interaction
// ===============================

client.on(
  'interactionCreate',
  async interaction => {

    try {

      // ===============================
      // Modal
      // ===============================

      if (
        interaction.isModalSubmit()
      ) {

        if (
          interaction.customId ===
          'panel_modal'
        ) {

          settings.panelDescription =

            interaction.fields.getTextInputValue(
              'description'
            );

          settings.panelButtonLabel =

            interaction.fields.getTextInputValue(
              'button'
            );

          saveSettings();

          return interaction.reply({

            content:
              'パネル設定保存完了',

            ephemeral: true

          });

        }

      }

      // ===============================
      // Button
      // ===============================

      if (
        interaction.isButton()
      ) {

        if (
          interaction.customId ===
          'open_panel'
        ) {

          return interaction.reply({

            content:
              'ボタンが押されました',

            ephemeral: true

          });

        }

      }

      // ===============================
      // Slash Command
      // ===============================

      if (
        !interaction.isChatInputCommand()
      ) return;

      // ===============================
      // Permission
      // ===============================

      if (

        interaction.commandName !==
          'コマンド権限許可' &&

        interaction.commandName !==
          'コマンド権限剥奪'

      ) {

        if (
          !hasPermission(
            interaction
          )
        ) {

          return interaction.reply({

            content:
              '権限がありません',

            ephemeral: true

          });

        }

      }

      // ===============================
      // コマンド権限許可
      // ===============================

      if (
        interaction.commandName ===
        'コマンド権限許可'
      ) {

        if (
          interaction.user.id !==
          interaction.guild.ownerId
        ) {

          return interaction.reply({

            content:
              'サーバー所有者限定',

            ephemeral: true

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
            `${role.name} を許可しました`,

          ephemeral: true

        });

      }

      // ===============================
      // コマンド権限剥奪
      // ===============================

      if (
        interaction.commandName ===
        'コマンド権限剥奪'
      ) {

        if (
          interaction.user.id !==
          interaction.guild.ownerId
        ) {

          return interaction.reply({

            content:
              'サーバー所有者限定',

            ephemeral: true

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
            `${role.name} を削除しました`,

          ephemeral: true

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

            settings.monitorEnabled
              ? '監視 ON'
              : '監視 OFF',

          ephemeral: true

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
            `${channel} に設定しました`,

          ephemeral: true

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

            settings.linkAlertEnabled
              ? 'リンク監視 ON'
              : 'リンク監視 OFF',

          ephemeral: true

        });

      }

      // ===============================
      // 新規アカウント
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

            settings.newAccountAlertEnabled
              ? '新規アカウント監視 ON'
              : '新規アカウント監視 OFF',

          ephemeral: true

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

`監視 : ${
settings.monitorEnabled ? 'ON' : 'OFF'
}

リンク監視 : ${
settings.linkAlertEnabled ? 'ON' : 'OFF'
}

新規アカウント監視 : ${
settings.newAccountAlertEnabled ? 'ON' : 'OFF'
}

アラートチャンネル :
${
settings.alertChannelId
? `<#${settings.alertChannelId}>`
: '未設定'
}`,

          ephemeral: true

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
          interaction.guild.members.cache;

        const bots =
          members.filter(
            m => m.user.bot
          ).size;

        const users =
          members.filter(
            m => !m.user.bot
          ).size;

        return interaction.reply({

          embeds: [

            new EmbedBuilder()

              .setTitle(
                'サーバー情報'
              )

              .setColor('Blue')

              .setDescription(

`サーバー名 :
${interaction.guild.name}

合計人数 :
${interaction.guild.memberCount}

一般ユーザー :
${users}

BOT :
${bots}

チャンネル数 :
${interaction.guild.channels.cache.size}

ロール数 :
${interaction.guild.roles.cache.size}`

              )

          ],

          ephemeral: true

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

            .setTitle(
              'パネル設定'
            );

        const description =
          new TextInputBuilder()

            .setCustomId(
              'description'
            )

            .setLabel(
              '説明'
            )

            .setStyle(
              TextInputStyle.Paragraph
            )

            .setRequired(true)

            .setValue(
              settings.panelDescription
            );

        const button =
          new TextInputBuilder()

            .setCustomId(
              'button'
            )

            .setLabel(
              'ボタン名'
            )

            .setStyle(
              TextInputStyle.Short
            )

            .setRequired(true)

            .setValue(
              settings.panelButtonLabel
            );

        modal.addComponents(

          new ActionRowBuilder()
            .addComponents(
              description
            ),

          new ActionRowBuilder()
            .addComponents(
              button
            )

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
              'サポート'
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
                  'open_panel'
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

    } catch (err) {

      console.error(err);

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        interaction.followUp({

          content:
            'エラーが発生しました',

          ephemeral: true

        }).catch(() => {});

      } else {

        interaction.reply({

          content:
            'エラーが発生しました',

          ephemeral: true

        }).catch(() => {});

      }

    }

  }
);

// ===============================
// Message Monitor
// ===============================

client.on(
  'messageCreate',
  async message => {

    try {

      if (
        message.author.bot
      ) return;

      if (
        !settings.monitorEnabled
      ) return;

      if (
        !settings.linkAlertEnabled
      ) return;

      if (
        !settings.alertChannelId
      ) return;

      const regex =
        /(https?:\/\/[^\s]+)/gi;

      if (
        regex.test(
          message.content
        )
      ) {

        const channel =

          message.guild.channels.cache.get(
            settings.alertChannelId
          );

        if (!channel) return;

        channel.send({

          embeds: [

            new EmbedBuilder()

              .setTitle(
                'リンク検知'
              )

              .setColor('Red')

              .setDescription(

`ユーザー :
${message.author.tag}

チャンネル :
${message.channel}

内容 :
${message.content}`

              )

          ]

        });

      }

    } catch (err) {

      console.error(err);

    }

  }
);

// ===============================
// New Account Monitor
// ===============================

client.on(
  'guildMemberAdd',
  async member => {

    try {

      if (
        !settings.newAccountAlertEnabled
      ) return;

      if (
        !settings.alertChannelId
      ) return;

      const age =
        Date.now() -
        member.user.createdTimestamp;

      const days =
        Math.floor(
          age /
          (1000 * 60 * 60 * 24)
        );

      if (days > 10) return;

      const channel =

        member.guild.channels.cache.get(
          settings.alertChannelId
        );

      if (!channel) return;

      channel.send({

        embeds: [

          new EmbedBuilder()

            .setTitle(
              '新規アカウント検知'
            )

            .setColor('Orange')

            .setDescription(

`ユーザー :
${member.user.tag}

作成日数 :
${days}日

ID :
${member.id}`

            )

        ]

      });

    } catch (err) {

      console.error(err);

    }

  }
);

// ===============================
// Error
// ===============================

process.on(
  'unhandledRejection',
  error => {
    console.error(error);
  }
);

process.on(
  'uncaughtException',
  error => {
    console.error(error);
  }
);

// ===============================
// Login
// ===============================

client.login(TOKEN);
```
