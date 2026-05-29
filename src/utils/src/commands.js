const {
  SlashCommandBuilder
} = require('discord.js');

async function registerCommands(
  client
) {

  const commands = [

    new SlashCommandBuilder()
      .setName('alert')
      .setDescription(
        '通知チャンネル設定'
      )
      .addChannelOption(o =>
        o.setName('channel')
          .setDescription(
            '通知先'
          )
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName('monitor')
      .setDescription(
        '監視 ON/OFF'
      )
      .addStringOption(o =>
        o.setName('type')
          .setDescription(
            '監視種類'
          )
          .setRequired(true)
          .addChoices(
            {
              name:
                'リンク監視',
              value:
                'link'
            },
            {
              name:
                '参加監視',
              value:
                'player'
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

    new SlashCommandBuilder()
      .setName('server')
      .setDescription(
        'サーバー情報'
      ),

    new SlashCommandBuilder()
      .setName('status')
      .setDescription(
        '現在設定'
      )

  ].map(c =>
    c.toJSON()
  );

  await client.application.commands.set(
    commands
  );
}

module.exports = {
  registerCommands
};
