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
TextInputStyle
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

console.log(
'Web Server Start: ' + PORT
);

});

// ===============================
// Discord Client
// ===============================

const client = new Client({

intents: [

```
GatewayIntentBits.Guilds,

GatewayIntentBits.GuildMembers,

GatewayIntentBits.GuildMessages,

GatewayIntentBits.MessageContent
```

]

});

// ===============================
// TOKEN
// ===============================

const TOKEN =
process.env.TOKEN;

// ===============================
// Settings File
// ===============================

const SETTINGS_FILE =
'./settings.json';

// ===============================
// Settings
// ===============================

let settings = {

monitorEnabled: true,

alertChannelId: null,

linkAlertEnabled: true,

newAccountAlertEnabled: true,

allowedRoleIds: [],

panelDescription:
'ここに説明を書いてください',

panelButtonLabel:
'開く'

};

// ===============================
// Load Settings
// ===============================

if (
fs.existsSync(SETTINGS_FILE)
) {

try {

```
const data =
  fs.readFileSync(
    SETTINGS_FILE,
    'utf8'
  );

settings =
  JSON.parse(data);

console.log(
  'Settings Loaded'
);
```

} catch (err) {

```
console.log(
  'Settings Load Error'
);
```

}

}

// ===============================
// Save Settings
// ===============================

function saveSettings() {

try {

```
fs.writeFileSync(

  SETTINGS_FILE,

  JSON.stringify(
    settings,
    null,
    2
  )

);

console.log(
  'Settings Saved'
);
```

} catch (err) {

```
console.log(
  'Settings Save Error'
);

console.error(err);
```

}

}

// ===============================
// Ready
// ===============================

client.once(
'ready',
async () => {

```
console.log(
  client.user.tag +
  ' Ready'
);

const commands = [

  new SlashCommandBuilder()

    .setName('監視')

    .setDescription(
      '監視ON/OFF'
    )

    .addBooleanOption(
      option =>

        option

          .setName('状態')

          .setDescription(
            'ON/OFF'
          )

          .setRequired(true)
    ),

  new SlashCommandBuilder()

    .setName(
      'アラートチャンネル'
    )

    .setDescription(
      'アラート送信先'
    )

    .addChannelOption(
      option =>

        option

          .setName(
            'チャンネル'
          )

          .setDescription(
            '送信先'
          )

          .addChannelTypes(
            ChannelType.GuildText
          )

          .setRequired(true)
    ),

  new SlashCommandBuilder()

    .setName(
      'リンクアラート'
    )

    .setDescription(
      'リンク監視'
    )

    .addBooleanOption(
      option =>

        option

          .setName('状態')

          .setDescription(
            'ON/OFF'
          )

          .setRequired(true)
    ),

  new SlashCommandBuilder()

    .setName(
      '新規アカウントアラート'
    )

    .setDescription(
      '10日以内監視'
    )

    .addBooleanOption(
      option =>

        option

          .setName('状態')

          .setDescription(
            'ON/OFF'
          )

          .setRequired(true)
    ),

  new SlashCommandBuilder()

    .setName('設定確認')

    .setDescription(
      '設定確認'
    ),

  new SlashCommandBuilder()

    .setName(
      'サーバー情報'
    )

    .setDescription(
      'サーバー情報'
    ),

  new SlashCommandBuilder()

    .setName(
      'コマンド権限許可'
    )

    .setDescription(
      '権限追加'
    )

    .addRoleOption(
      option =>

        option

          .setName('ロール')

          .setDescription(
            '許可ロール'
          )

          .setRequired(true)
    ),

  new SlashCommandBuilder()

    .setName(
      'コマンド権限剥奪'
    )

    .setDescription(
      '権限削除'
    )

    .addRoleOption(
      option =>

        option

          .setName('ロール')

          .setDescription(
            '削除ロール'
          )

          .setRequired(true)
    ),

  new SlashCommandBuilder()

    .setName(
      'パネル設定'
    )

    .setDescription(
      '説明とボタン設定'
    ),

  new SlashCommandBuilder()

    .setName('パネル')

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
```

}
);

// ===============================
// Interaction
// ===============================

client.on(
'interactionCreate',
async interaction => {

```
// Modal

if (
  interaction.isModalSubmit()
) {

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
        'パネル設定保存完了',

      ephemeral: true

    });

  }

}

// Button

if (
  interaction.isButton()
) {

  if (
    interaction.customId ===
    'open_ticket'
  ) {

    return interaction.reply({

      content:
        'ボタンが押されました',

      ephemeral: true

    });

  }

}

// Slash

if (
  !interaction.isChatInputCommand()
) return;

const guild =
  interaction.guild;

const isOwner =
  interaction.user.id ===
  guild.ownerId;

const hasAllowedRole =
  interaction.member.roles.cache.some(
    role =>

      settings.allowedRoleIds.includes(
        role.id
      )
  );

if (

  !isOwner &&

  !hasAllowedRole &&

  interaction.commandName !==
    'コマンド権限許可' &&

  interaction.commandName !==
    'コマンド権限剥奪'

) {

  return interaction.reply({

    content:
      '権限なし',

    ephemeral: true

  });

}

// 監視

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
      '監視: ' +

      (
        settings.monitorEnabled
          ? 'ON'
          : 'OFF'
      ),

    ephemeral: true

  });

}

// アラートチャンネル

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
      '設定完了',

    ephemeral: true

  });

}

// リンクアラート

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
      'リンク監視変更完了',

    ephemeral: true

  });

}

// 新規アカウント

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
      '新規アカウント監視変更完了',

    ephemeral: true

  });

}

// 設定確認

if (
  interaction.commandName ===
  '設定確認'
) {

  return interaction.reply({

    content:

      '監視: ' +
      (
        settings.monitorEnabled
          ? 'ON'
          : 'OFF'
      ) +

      '\n\nリンク監視: ' +

      (
        settings.linkAlertEnabled
          ? 'ON'
          : 'OFF'
      ) +

      '\n\n新規アカウント監視: ' +

      (
        settings.newAccountAlertEnabled
          ? 'ON'
          : 'OFF'
      ),

    ephemeral: true

  });

}

// サーバー情報

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

      'サーバー名:\n' +
      guild.name +

      '\n\n合計人数:\n' +
      guild.memberCount +

      '\n\n一般ユーザー:\n' +
      userCount +

      '\n\nBOT:\n' +
      botCount,

    ephemeral: true

  });

}

// パネル設定

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

// パネル

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
```

}
);

// ===============================
// Link Monitor
// ===============================

client.on(
'messageCreate',
async message => {

```
if (
  message.author.bot
) return;

if (
  !settings.monitorEnabled
) return;

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

        'リンク検知\n\n' +

        'ユーザー:\n' +
        message.author.tag +

        '\n\n内容:\n' +
        message.content

      );

    }

  }

}
```

}
);

// ===============================
// New Account
// ===============================

client.on(
'guildMemberAdd',
async member => {

```
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

  (
    1000 *
    60 *
    60 *
    24
  )

);

if (days <= 10) {

  const channel =
    member.guild.channels.cache.get(
      settings.alertChannelId
    );

  if (channel) {

    channel.send(

      '新規アカウント検知\n\n' +

      'ユーザー:\n' +
      member.user.tag +

      '\n\n作成日数:\n' +
      days +
      '日'

    );

  }

}
```

}
);

// ===============================
// Login
// ===============================

client.login(TOKEN);
