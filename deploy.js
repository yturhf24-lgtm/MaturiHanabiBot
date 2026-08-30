const { REST, Routes } = require('discord.js');
const fs = require('fs');

const cmds = [];
for (const f of fs.readdirSync('./commands').filter(f => f.endsWith('.js'))) {
  cmds.push(require(`./commands/${f}`).data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: cmds })
.then(() => console.log('✅ コマンド登録完了'))
.catch(e => console.error('❌ エラー:', e));
