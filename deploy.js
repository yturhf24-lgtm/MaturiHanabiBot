const { REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const cmds = [];
for (const f of fs.readdirSync('./commands').filter(f => f.endsWith('.js'))) {
  cmds.push(require(`./commands/${f}`).data.toJSON());
}

new REST({version:'10'}).setToken(process.env.TOKEN)
.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {body: cmds})
.then(() => console.log('✅ コマンド登録OK!'))
.catch(e => console.error(e));
