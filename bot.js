// =====================
// Discord BOT 完成版
// discord.js v14
// =====================

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

const OWNER_ID = '1266013271518089258';

// =====================
// settings
// =====================
function load() {

  if (!fs.existsSync(SETTINGS)) {

    const def = {
      alertChannelId: null,
      panelChannelId: null,
      panelViewChannelId: null,
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
    fs.readFileSync(
      SETTINGS,
      'utf8'
    )
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
// embeds
// =====================
function okEmbed(title, desc) {

  return new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle(title)
    .setDescription(desc)
    .setTimestamp();
}

function errorEmbed(desc) {

  return new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('エラー')
    .setDescription(desc)
    .setTimestamp();
}

function infoEmbed(title, desc) {

  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(title)
    .setDescription(desc)
    .setTimestamp();
}

// =====================
// util
// =====================
function isAdmin(i, s) {

  if (i.user.id === OWNER_ID)
    return true;

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
          '❌ アラートチャンネル未設定'
        )
      ]
    });

    return false;
  }

  return true;
}

function formatDate(date = new Date()) {

  return date.toLocaleString(
    'ja-JP',
    {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }
  );
}

function getActivityRate(
  online,
  total
) {

  if (!total) return '不明';

  const rate =
    Math.floor(
      (online / total) * 100
    );

  if (rate >= 70)
    return `超活発 (${rate}%)`;

  if (rate >= 40)
    return `普通 (${rate}%)`;

  if (rate >= 20)
    return `少し過疎 (${rate}%)`;

  return `過疎 (${rate}%)`;
}

// =====================
// ready
// =====================
client.once('ready', async () => {

  console.log(
    `${client.user.tag} Ready`
  );

  const commands = [

    // alert
    new SlashCommandBuilder()
      .setName('alert')
      .setDescription(
        '通知チャンネル設定'
      )
      .addChannelOption(o =>
        o.setName('channel')
          .setDescription(
            '通知先チャンネル'
          )
          .setRequired(true)
      ),

    // monitor
    new SlashCommandBuilder()
      .setName('monitor')
      .setDescription(
        '監視機能 ON/OFF'
      )
      .addStringOption(o =>
        o.setName('type')
          .setDescription(
            '監視種類'
          )
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
      )
      .addStringOption(o =>
        o.setName('mode')
          .setDescription(
            'ON/OFF'
          )
          .setRequired(true)
          .addChoices(
            {
              name: 'ON',
              value: 'on'
            },
            {
              name: 'OFF',
              value: 'off'
            }
          )
      ),

    // role
    new SlashCommandBuilder()
      .setName('role')
      .setDescription(
        'コマンド権限ロール'
      )
      .addSubcommand(s =>
        s.setName('add')
          .setDescription(
            'ロール追加'
          )
          .addRoleOption(o =>
            o.setName('role')
              .setDescription(
                'ロール'
              )
              .setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('clear')
          .setDescription(
            'ロール全削除'
          )
      ),

    // panel
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription(
        'パネル管理'
      )
      .addSubcommand(s =>
        s.setName('setchannel')
          .setDescription(
            'パネル送信先設定'
          )
          .addChannelOption(o =>
            o.setName('channel')
              .setDescription(
                '送信先'
              )
              .setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('setviewchannel')
          .setDescription(
            '回答表示先設定'
          )
          .addChannelOption(o =>
            o.setName('channel')
              .setDescription(
                '表示先'
              )
              .setRequired(true)
          )
      )
      .addSubcommand(s =>
        s.setName('create')
          .setDescription(
            'パネル生成'
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

    // slash
    if (i.isChatInputCommand()) {

      const noDefer =
        i.commandName === 'panel' &&
        i.options.getSubcommand() ===
          'create';

      if (!noDefer) {

        await i.deferReply({
          ephemeral: true
        });
      }

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
                  '❌ 権限なし'
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
                'アラート設定',
                `設定先: ${ch}`
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
                  '❌ 権限なし'
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

          const mode =
            i.options.getString(
              'mode'
            );

          const enabled =
            mode === 'on';

          if (type === 'link') {

            s.linkAlertEnabled =
              enabled;

            save(s);

            return i.editReply({
              embeds: [
                infoEmbed(
                  'リンク監視',
                  enabled
                    ? '✅ ON'
                    : '❌ OFF'
                )
              ]
            });
          }

          if (type === 'player') {

            s.playerMonitorEnabled =
              enabled;

            save(s);

            return i.editReply({
              embeds: [
                infoEmbed(
                  '参加監視',
                  enabled
                    ? '✅ ON'
                    : '❌ OFF'
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
                  '❌ 権限なし'
                )
              ]
            });
          }

          const sub =
            i.options.getSubcommand();

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
                  'ロール追加',
                  `${role} を追加`
                )
              ]
            });
          }

          if (sub === 'clear') {

            s.allowedRoles = [];

            save(s);

            return i.editReply({
              embeds: [
                infoEmbed(
                  'ロール削除',
                  '全削除しました'
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
                  '❌ 権限なし'
                )
              ]
            });
          }

          const sub =
            i.options.getSubcommand();

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
                  'パネル送信先',
                  `設定: ${ch}`
                )
              ]
            });
          }

          if (
            sub ===
            'setviewchannel'
          ) {

            const ch =
              i.options.getChannel(
                'channel'
              );

            s.panelViewChannelId =
              ch.id;

            save(s);

            return i.editReply({
              embeds: [
                okEmbed(
                  '回答表示先',
                  `設定: ${ch}`
                )
              ]
            });
          }

          if (sub === 'create') {

            if (
              !s.panelChannelId
            ) {

              return i.reply({
                embeds: [
                  errorEmbed(
                    '❌ パネル送信先未設定'
                  )
                ],
                ephemeral: true
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

          const textChannels =
            g.channels.cache.filter(
              c =>
                c.type ===
                ChannelType.GuildText
            ).size;

          const voiceChannels =
            g.channels.cache.filter(
              c =>
                c.type ===
                ChannelType.GuildVoice
            ).size;

          const categoryChannels =
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
                    '👥 メンバー',
                  value:
`総人数: ${g.memberCount}
一般: ${humans}
BOT: ${bots}`,
                  inline: true
                },

                {
                  name:
                    '📶 ステータス',
                  value:
`🟢 オンライン: ${online}
🌙 退席中: ${idle}
⛔ 取り込み中: ${dnd}
⚫ オフライン: ${offline}`,
                  inline: true
                },

                {
                  name:
                    '📁 チャンネル',
                  value:
`テキスト: ${textChannels}
ボイス: ${voiceChannels}
カテゴリ: ${categoryChannels}`,
                  inline: true
                },

                {
                  name:
                    '🚀 ブースト',
                  value:
`レベル: ${g.premiumTier}
回数: ${
  g.premiumSubscriptionCount ?? 0
}`,
                  inline: true
                },

                {
                  name:
                    '📅 作成日',
                  value:
                    formatDate(
                      new Date(
                        g.createdTimestamp
                      )
                    ),
                  inline: true
                },

                {
                  name:
                    '📉 過疎度',
                  value:
                    getActivityRate(
                      online +
                        idle +
                        dnd,
                      g.memberCount
                    ),
                  inline: true
                }
              )
              .setTimestamp();

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
                '⚙️ 現在設定'
              )
              .addFields(
                {
                  name:
                    'アラート',
                  value:
                    s.alertChannelId
                      ? `<#${s.alertChannelId}>`
                      : '未設定'
                },
                {
                  name:
                    'リンク監視',
                  value:
                    s.linkAlertEnabled
                      ? 'ON'
                      : 'OFF',
                  inline: true
                },
                {
                  name:
                    '参加監視',
                  value:
                    s.playerMonitorEnabled
                      ? 'ON'
                      : 'OFF',
                  inline: true
                },
                {
                  name:
                    'パネル送信先',
                  value:
                    s.panelChannelId
                      ? `<#${s.panelChannelId}>`
                      : '未設定'
                },
                {
                  name:
                    '回答表示先',
                  value:
                    s.panelViewChannelId
                      ? `<#${s.panelViewChannelId}>`
                      : '未設定'
                }
              )
              .setTimestamp();

          return i.editReply({
            embeds: [embed]
          });
        }

      } catch (e) {

        console.error(e);

      }
    }

    // =====================
    // modal
    // =====================
    if (i.isModalSubmit()) {

      const s = load();

      // panel create
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

        const embed =
          new EmbedBuilder()
            .setColor(
              0x2b2d31
            )
            .setTitle(
              '📨 受付パネル'
            )
            .setDescription(
              text
            )
            .setTimestamp();

        const row =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  'panel_button'
                )
                .setLabel(
                  '入力'
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
              'パネル生成',
              '送信しました'
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

        const ch =
          i.guild.channels.cache.get(
            s.panelViewChannelId
          );

        if (!ch) {

          return i.reply({
            embeds: [
              errorEmbed(
                '❌ 回答表示先未設定'
              )
            ],
            ephemeral: true
          });
        }

        const embed =
          new EmbedBuilder()
            .setColor(
              0x5865f2
            )
            .setTitle(
              '📨 新しい送信'
            )
            .setDescription(
              msg
            )
            .addFields(
              {
                name:
                  '👤 ユーザー情報',
                value:
`表示名: ${i.member.displayName}
名前: ${i.user.username}
メンション: ${i.user}`
              },
              {
                name:
                  '🕒 日時',
                value:
                  formatDate()
              }
            )
            .setTimestamp();

        await ch.send({
          embeds: [embed]
        });

        return i.reply({
          embeds: [
            okEmbed(
              '送信完了',
              '送信しました'
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
              '内容入力'
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

      // warning
      await m.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(
              0xed4245
            )
            .setTitle(
              '⚠️ リンク監視'
            )
            .setDescription(
`リンクは監視されています。

危険なリンクを送信した場合、
BANされる可能性があります。`
            )
            .setTimestamp()
        ]
      }).then(msg => {

        setTimeout(() => {
          msg.delete().catch(() => {});
        }, 10000);

      }).catch(() => {});

      // alert
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
            '🚨 リンク検知通知'
          )
          .setDescription(
            m.content
          )
          .addFields(
            {
              name:
                '👤 ユーザー情報',
              value:
`表示名: ${m.member.displayName}
名前: ${m.author.username}
メンション: ${m.author}`
            },
            {
              name:
                '📍 チャンネル',
              value:
                `${m.channel}`
            },
            {
              name:
                '🕒 日時',
              value:
                formatDate()
            }
          )
          .setTimestamp();

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
          '📥 新規参加通知'
        )
        .setDescription(
`${member} が参加しました`
        )
        .setThumbnail(
          member.user.displayAvatarURL()
        )
        .addFields(
          {
            name:
              '👤 ユーザー情報',
            value:
`表示名: ${member.displayName}
名前: ${member.user.username}
メンション: ${member}`
          },
          {
            name:
              '🕒 日時',
            value:
              formatDate()
          }
        )
        .setTimestamp();

    ch.send({
      embeds: [embed]
    });
  }
);

// =====================
// login
// =====================
client.login(TOKEN);
