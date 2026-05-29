const {
  SlashCommandBuilder
} = require('discord.js');

async function registerCommands(
  client
) {

  const commands = [

    // =====================
    // alert
    // =====================
    new SlashCommandBuilder()

      .setName('alert')

      .setNameLocalizations({
        ja: 'アラート'
      })

      .setDescription(
        'Set alert channel'
      )

      .setDescriptionLocalizations({
        ja: 'アラート通知チャンネル設定'
      })

      .addChannelOption(o =>

        o.setName('channel')

          .setNameLocalizations({
            ja: 'チャンネル'
          })

          .setDescription(
            'Alert channel'
          )

          .setDescriptionLocalizations({
            ja: '通知先チャンネル'
          })

          .setRequired(true)
      ),

    // =====================
    // monitor
    // =====================
    new SlashCommandBuilder()

      .setName('monitor')

      .setNameLocalizations({
        ja: '監視'
      })

      .setDescription(
        'Monitor ON/OFF'
      )

      .setDescriptionLocalizations({
        ja: '監視機能 ON/OFF'
      })

      // monitor type
      .addStringOption(o =>

        o.setName('type')

          .setNameLocalizations({
            ja: '種類'
          })

          .setDescription(
            'Monitor type'
          )

          .setDescriptionLocalizations({
            ja: '監視タイプ'
          })

          .setRequired(true)

          .addChoices(

            {
              name:
                'Link Monitor',
              value:
                'link',

              name_localizations: {
                ja:
                  'リンク監視'
              }
            },

            {
              name:
                'Join Monitor',
              value:
                'player',

              name_localizations: {
                ja:
                  '参加監視'
              }
            }
          )
      )

      // monitor mode
      .addStringOption(o =>

        o.setName('mode')

          .setNameLocalizations({
            ja: 'モード'
          })

          .setDescription(
            'ON/OFF'
          )

          .setDescriptionLocalizations({
            ja: 'ON/OFF'
          })

          .setRequired(true)

          .addChoices(

            {
              name:
                'ON',
              value:
                'on'
            },

            {
              name:
                'OFF',
              value:
                'off'
            }
          )
      ),

    // =====================
    // role
    // =====================
    new SlashCommandBuilder()

      .setName('role')

      .setNameLocalizations({
        ja: 'ロール'
      })

      .setDescription(
        'Role settings'
      )

      .setDescriptionLocalizations({
        ja: 'コマンド許可ロール設定'
      })

      // add
      .addSubcommand(s =>

        s.setName('add')

          .setNameLocalizations({
            ja: '追加'
          })

          .setDescription(
            'Add role permission'
          )

          .setDescriptionLocalizations({
            ja: '許可ロール追加'
          })

          .addRoleOption(o =>

            o.setName('role')

              .setNameLocalizations({
                ja: 'ロール'
              })

              .setDescription(
                'Select role'
              )

              .setDescriptionLocalizations({
                ja: 'ロール選択'
              })

              .setRequired(true)
          )
      )

      // remove
      .addSubcommand(s =>

        s.setName('remove')

          .setNameLocalizations({
            ja: '削除'
          })

          .setDescription(
            'Remove role permission'
          )

          .setDescriptionLocalizations({
            ja: '許可ロール削除'
          })

          .addRoleOption(o =>

            o.setName('role')

              .setNameLocalizations({
                ja: 'ロール'
              })

              .setDescription(
                'Select role'
              )

              .setDescriptionLocalizations({
                ja: 'ロール選択'
              })

              .setRequired(true)
          )
      )

      // clear
      .addSubcommand(s =>

        s.setName('clear')

          .setNameLocalizations({
            ja: '全削除'
          })

          .setDescription(
            'Clear all roles'
          )

          .setDescriptionLocalizations({
            ja: '許可ロール全削除'
          )
      ),

    // =====================
    // panel
    // =====================
    new SlashCommandBuilder()

      .setName('panel')

      .setNameLocalizations({
        ja: 'パネル'
      })

      .setDescription(
        'Panel settings'
      )

      .setDescriptionLocalizations({
        ja: 'パネル管理'
      })

      // setchannel
      .addSubcommand(s =>

        s.setName(
          'setchannel'
        )

          .setNameLocalizations({
            ja: '送信先'
          })

          .setDescription(
            'Set panel send channel'
          )

          .setDescriptionLocalizations({
            ja: 'パネル送信先設定'
          })

          .addChannelOption(o =>

            o.setName(
              'channel'
            )

              .setNameLocalizations({
                ja: 'チャンネル'
              })

              .setDescription(
                'Select channel'
              )

              .setDescriptionLocalizations({
                ja: 'チャンネル選択'
              })

              .setRequired(true)
          )
      )

      // setviewchannel
      .addSubcommand(s =>

        s.setName(
          'setviewchannel'
        )

          .setNameLocalizations({
            ja: '回答先'
          })

          .setDescription(
            'Set answer view channel'
          )

          .setDescriptionLocalizations({
            ja: '回答表示先設定'
          })

          .addChannelOption(o =>

            o.setName(
              'channel'
            )

              .setNameLocalizations({
                ja: 'チャンネル'
              })

              .setDescription(
                'Select channel'
              )

              .setDescriptionLocalizations({
                ja: 'チャンネル選択'
              })

              .setRequired(true)
          )
      )

      // create
      .addSubcommand(s =>

        s.setName(
          'create'
        )

          .setNameLocalizations({
            ja: '生成'
          })

          .setDescription(
            'Create panel'
          )

          .setDescriptionLocalizations({
            ja: 'パネル生成'
          )
      ),

    // =====================
    // server
    // =====================
    new SlashCommandBuilder()

      .setName('server')

      .setNameLocalizations({
        ja: 'サーバー'
      })

      .setDescription(
        'Show server information'
      )

      .setDescriptionLocalizations({
        ja: 'サーバー情報表示'
      }),

    // =====================
    // status
    // =====================
    new SlashCommandBuilder()

      .setName('status')

      .setNameLocalizations({
        ja: '設定'
      })

      .setDescription(
        'Show current settings'
      )

      .setDescriptionLocalizations({
        ja: '現在設定確認'
      })

  ].map(c =>
    c.toJSON()
  );

  // =====================
  // register
  // =====================
  await client.application.commands.set(
    commands
  );

  console.log(
    '✅ スラッシュコマンド登録完了'
  );
}

module.exports = {
  registerCommands
};
