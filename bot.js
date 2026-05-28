const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType
} = require('discord.js');

const fs = require('fs');

const TOKEN = 'MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s';
const SETTINGS = './settings.json';

// =====================
// settings
// =====================
function load() {

  if (!fs.existsSync(SETTINGS)) {

    const def = {
      alertChannelId: null,
      panelChannelId: null,
      allowedRoles: [],
      linkAlertEnabled: false,
      playerMonitorEnabled: false
    };

    fs.writeFileSync(
      SETTINGS,
      JSON.stringify(def, null, 2)
    );
  }

  return JSON.parse(
    fs.readFileSync(SETTINGS)
  );
}

function save(data) {

  fs.writeFileSync(
    SETTINGS,
    JSON.stringify(data, null, 2)
  );
}

// =====================
// client
// =====================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ]
});

// =====================
// util
// =====================
function okEmbed(title, desc) {

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(title)
    .setDescription(desc);
}

function errorEmbed(desc) {

  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle("エラー")
    .setDescription(desc);
}

function infoEmbed(title, desc) {

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(desc);
}

function isAdmin(i, s) {

  if (
    i.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  ) return true;

  if (!s.allowedRoles.length)
    return false;

  return i.member.roles.cache.some(r =>
    s.allowedRoles.includes(r.id)
  );
}

async function requireAlert(i, s) {

  if (!s.alertChannelId) {

    await i.editReply({
      embeds: [
        errorEmbed(
          "❌ アラートチャンネル未設定"
        )
      ]
    });

    return false;
  }

  return true;
}

// =====================
// ready
// =====================
client.once('ready', async () => {

  console.log(`${client.user.tag} Ready`);

  const commands = [

    // alert
    new SlashCommandBuilder()
      .setName('alert')
      .setDescription(
        'アラートチャンネル設定'
      )
      .addChannelOption(o =>
        o.setName('channel')
          .setDescription('チャンネル')
          .setRequired(true)
      ),

    // monitor
    new SlashCommandBuilder()
      .setName('monitor')
      .setDescription(
        '監視ON/OFF'
      )
      .addStringOption(o =>
        o.setName('type')
          .setDescription('種類')
          .setRequired(true)
          .addChoices(
            {
              name: 'リンク監視',
              value: 'link'
            },
            {
              name: '参加監視',
              value: 'player'
            }
          )
      ),

    // role
    new SlashCommandBuilder()
      .setName('role')
      .setDescription(
        '許可ロール管理'
      )
      .addSubcommand(s =>
        s.setName('add')
          .setDescription('追加')
          .addRoleOption(o =>
            o.setName('role')
              .setDescription('ロール')
              .setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('clear')
          .setDescription(
            '全削除'
          )
      ),

    // panel
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription(
        '説明パネル'
      )
      .addSubcommand(s =>
        s.setName('setchannel')
          .setDescription(
            'チャンネル設定'
          )
          .addChannelOption(o =>
            o.setName('channel')
              .setDescription(
                'チャンネル'
              )
              .setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('create')
          .setDescription(
            'パネル送信'
          )
      ),

    // server
    new SlashCommandBuilder()
      .setName('server')
      .setDescription(
        'サーバー情報'
      ),

    // status
    new SlashCommandBuilder()
      .setName('status')
      .setDescription(
        '設定確認'
      )

  ].map(c => c.toJSON());

  await client.application.commands.set(
    commands
  );
});

// =====================
// interaction
// =====================
client.on(
  'interactionCreate',
  async i => {

    // =====================
    // slash
    // =====================
    if (i.isChatInputCommand()) {

      await i.deferReply({
        ephemeral: true
      });

      const s = load();

      try {

        // =====================
        // alert
        // =====================
        if (i.commandName === 'alert') {

          if (!isAdmin(i, s)) {

            return i.editReply({
              embeds: [
                errorEmbed(
                  "❌ 権限なし"
                )
              ]
            });
          }

          const ch =
            i.options.getChannel(
              'channel'
            );

          s.alertChannelId = ch.id;

          save(s);

          return i.editReply({
            embeds: [
              okEmbed(
                "アラート設定",
                `設定: ${ch}`
              )
            ]
          });
        }

        // =====================
        // monitor
        // =====================
        if (i.commandName === 'monitor') {

          if (!isAdmin(i, s)) {

            return i.editReply({
              embeds: [
                errorEmbed(
                  "❌ 権限なし"
                )
              ]
            });
          }

          if (
            !(await requireAlert(i, s))
          ) return;

          const type =
            i.options.getString(
              'type'
            );

          // link
          if (type === 'link') {

            s.linkAlertEnabled =
              !s.linkAlertEnabled;

            save(s);

            return i.editReply({
              embeds: [
                infoEmbed(
                  "リンク監視",
                  s.linkAlertEnabled
                    ? "✅ ON"
                    : "❌ OFF"
                )
              ]
            });
          }

          // player
          if (type === 'player') {

            s.playerMonitorEnabled =
              !s.playerMonitorEnabled;

            save(s);

            return i.editReply({
              embeds: [
                infoEmbed(
                  "参加監視",
                  s.playerMonitorEnabled
                    ? "✅ ON"
                    : "❌ OFF"
                )
              ]
            });
          }
        }

        // =====================
        // role
        // =====================
        if (i.commandName === 'role') {

          if (!isAdmin(i, s)) {

            return i.editReply({
              embeds: [
                errorEmbed(
                  "❌ 権限なし"
                )
              ]
            });
          }

          const sub =
            i.options.getSubcommand();

          // add
          if (sub === 'add') {

            const role =
              i.options.getRole(
                'role'
              );

            if (
              !s.allowedRoles.includes(
                role.id
              )
            ) {
              s.allowedRoles.push(
                role.id
              );
            }

            save(s);

            return i.editReply({
              embeds: [
                okEmbed(
                  "ロール追加",
                  `${role} を追加`
                )
              ]
            });
          }

          // clear
          if (sub === 'clear') {

            s.allowedRoles = [];

            save(s);

            return i.editReply({
              embeds: [
                infoEmbed(
                  "ロール削除",
                  "全削除しました"
                )
              ]
            });
          }
        }

        // =====================
        // panel
        // =====================
        if (i.commandName === 'panel') {

          if (!isAdmin(i, s)) {

            return i.editReply({
              embeds: [
                errorEmbed(
                  "❌ 権限なし"
                )
              ]
            });
          }

          const sub =
            i.options.getSubcommand();

          // setchannel
          if (
            sub === 'setchannel'
          ) {

            const ch =
              i.options.getChannel(
                'channel'
              );

            s.panelChannelId =
              ch.id;

            save(s);

            return i.editReply({
              embeds: [
                okEmbed(
                  "パネル設定",
                  `設定: ${ch}`
                )
              ]
            });
          }

          // create
          if (sub === 'create') {

            if (
              !s.panelChannelId
            ) {

              return i.editReply({
                embeds: [
                  errorEmbed(
                    "❌ パネルチャンネル未設定"
                  )
                ]
              });
            }

            const modal =
              new ModalBuilder()
                .setCustomId(
                  'panel_modal'
                )
                .setTitle(
                  '説明入力'
                );

            const input =
              new TextInputBuilder()
                .setCustomId(
                  'panel_text'
                )
                .setLabel(
                  '説明'
                )
                .setStyle(
                  TextInputStyle.Paragraph
                )
                .setRequired(
                  true
                );

            modal.addComponents(
              new ActionRowBuilder()
                .addComponents(
                  input
                )
            );

            return i.showModal(
              modal
            );
          }
        }

        // =====================
        // server
        // =====================
        if (i.commandName === 'server') {

          const g = i.guild;

          await g.members.fetch();

          const humans =
            g.members.cache.filter(
              m => !m.user.bot
            ).size;

          const bots =
            g.members.cache.filter(
              m => m.user.bot
            ).size;

          const online =
            g.members.cache.filter(
              m =>
                m.presence?.status ===
                'online'
            ).size;

          const offline =
            g.members.cache.filter(
              m =>
                !m.presence ||
                m.presence.status ===
                  'offline'
            ).size;

          const idle =
            g.members.cache.filter(
              m =>
                m.presence?.status ===
                'idle'
            ).size;

          const dnd =
            g.members.cache.filter(
              m =>
                m.presence?.status ===
                'dnd'
            ).size;

          const text =
            g.channels.cache.filter(
              c =>
                c.type ===
                ChannelType.GuildText
            ).size;

          const voice =
            g.channels.cache.filter(
              c =>
                c.type ===
                ChannelType.GuildVoice
            ).size;

          const category =
            g.channels.cache.filter(
              c =>
                c.type ===
                ChannelType.GuildCategory
            ).size;

          const embed =
            new EmbedBuilder()
              .setColor(
                0x2b2d31
              )
              .setTitle(
                `${g.name} サーバー情報`
              )
              .setThumbnail(
                g.iconURL({
                  dynamic: true
                })
              )
              .addFields(
                {
                  name:
                    "メンバー",
                  value:
`総数: ${g.memberCount}
一般: ${humans}
BOT: ${bots}`,
                  inline: true
                },
                {
                  name:
                    "ステータス",
                  value:
`🟢 オンライン: ${online}
🌙 退席中: ${idle}
⛔ 取り込み中: ${dnd}
⚫ オフライン: ${offline}`,
                  inline: true
                },
                {
                  name:
                    "チャンネル",
                  value:
`テキスト: ${text}
ボイス: ${voice}
カテゴリ: ${category}`,
                  inline: true
                },
                {
                  name:
                    "ブースト",
                  value:
`レベル: ${g.premiumTier}
回数: ${g.premiumSubscriptionCount}`,
                  inline: false
                },
                {
                  name:
                    "作成日",
                  value:
`<t:${Math.floor(
  g.createdTimestamp /
    1000
)}:F>`,
                  inline: false
                }
              );

          return i.editReply({
            embeds: [embed]
          });
        }

        // =====================
        // status
        // =====================
        if (i.commandName === 'status') {

          const embed =
            new EmbedBuilder()
              .setColor(
                0x5865f2
              )
              .setTitle(
                "設定一覧"
              )
              .addFields(
                {
                  name:
                    "アラート",
                  value:
                    s.alertChannelId
                      ? `<#${s.alertChannelId}>`
                      : "OFF",
                  inline: false
                },
                {
                  name:
                    "リンク監視",
                  value:
                    s.linkAlertEnabled
                      ? "ON"
                      : "OFF",
                  inline: true
                },
                {
                  name:
                    "参加監視",
                  value:
                    s.playerMonitorEnabled
                      ? "ON"
                      : "OFF",
                  inline: true
                },
                {
                  name:
                    "パネルチャンネル",
                  value:
                    s.panelChannelId
                      ? `<#${s.panelChannelId}>`
                      : "未設定",
                  inline: false
                }
              );

          return i.editReply({
            embeds: [embed]
          });
        }

      } catch (e) {

        console.error(e);

        return i.editReply({
          embeds: [
            errorEmbed(
              "❌ エラー"
            )
          ]
        });
      }
    }

    // =====================
    // modal
    // =====================
    if (i.isModalSubmit()) {

      const s = load();

      // panel
      if (
        i.customId ===
        'panel_modal'
      ) {

        const text =
          i.fields.getTextInputValue(
            'panel_text'
          );

        const ch =
          i.guild.channels.cache.get(
            s.panelChannelId
          );

        if (!ch) {

          return i.reply({
            embeds: [
              errorEmbed(
                "❌ チャンネルなし"
              )
            ],
            ephemeral: true
          });
        }

        const embed =
          new EmbedBuilder()
            .setColor(
              0x2b2d31
            )
            .setDescription(
              text
            );

        const row =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  'panel_button'
                )
                .setLabel(
                  '送信'
                )
                .setStyle(
                  ButtonStyle.Primary
                )
            );

        await ch.send({
          embeds: [embed],
          components: [row]
        });

        return i.reply({
          embeds: [
            okEmbed(
              "パネル",
              "送信しました"
            )
          ],
          ephemeral: true
        });
      }

      // button modal
      if (
        i.customId ===
        'button_modal'
      ) {

        const msg =
          i.fields.getTextInputValue(
            'button_text'
          );

        return i.reply({
          embeds: [
            infoEmbed(
              "送信内容",
              msg
            )
          ],
          ephemeral: true
        });
      }
    }

    // =====================
    // button
    // =====================
    if (i.isButton()) {

      if (
        i.customId ===
        'panel_button'
      ) {

        const modal =
          new ModalBuilder()
            .setCustomId(
              'button_modal'
            )
            .setTitle(
              '入力'
            );

        const input =
          new TextInputBuilder()
            .setCustomId(
              'button_text'
            )
            .setLabel(
              '内容'
            )
            .setStyle(
              TextInputStyle.Paragraph
            );

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(
              input
            )
        );

        return i.showModal(
          modal
        );
      }
    }
  }
);

// =====================
// link monitor
// =====================
client.on(
  'messageCreate',
  async m => {

    if (m.author.bot) return;
    if (!m.guild) return;

    const s = load();

    if (
      !s.linkAlertEnabled
    ) return;

    if (
      !s.alertChannelId
    ) return;

    if (
      /(https?:\/\/)/.test(
        m.content
      )
    ) {

      const ch =
        m.guild.channels.cache.get(
          s.alertChannelId
        );

      if (!ch) return;

      const embed =
        new EmbedBuilder()
          .setColor(
            0xed4245
          )
          .setTitle(
            "リンク検知"
          )
          .setDescription(
            m.content
          )
          .addFields(
            {
              name:
                "ユーザー",
              value:
                m.author.tag
            },
            {
              name:
                "チャンネル",
              value:
                `${m.channel}`
            }
          );

      ch.send({
        embeds: [embed]
      });
    }
  }
);

// =====================
// join monitor
// =====================
client.on(
  'guildMemberAdd',
  async member => {

    const s = load();

    if (
      !s.playerMonitorEnabled
    ) return;

    if (
      !s.alertChannelId
    ) return;

    const ch =
      member.guild.channels.cache.get(
        s.alertChannelId
      );

    if (!ch) return;

    const embed =
      new EmbedBuilder()
        .setColor(
          0x57f287
        )
        .setTitle(
          "参加通知"
        )
        .setDescription(
          `${member.user.tag} が参加しました`
        )
        .setThumbnail(
          member.user.displayAvatarURL()
        );

    ch.send({
      embeds: [embed]
    });
  }
);

// =====================
// login
// =====================
client.login(TOKEN);
