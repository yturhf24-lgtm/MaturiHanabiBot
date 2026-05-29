const {
  Client,
  GatewayIntentBits
} = require('discord.js');

const {
  registerCommands
} = require('./src/commands');

const {
  interactionHandler
} = require('./src/events/interactionCreate');

const {
  linkMonitor
} = require('./src/events/messageCreate');

const {
  joinMonitor
} = require('./src/events/guildMemberAdd');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildPresences
  ]
});

client.once(
  'ready',
  async () => {

    console.log(
      `${client.user.tag} Ready`
    );

    await registerCommands(
      client
    );
  }
);

client.on(
  'interactionCreate',
  i => interactionHandler(
    client,
    i
  )
);

client.on(
  'messageCreate',
  m => linkMonitor(
    client,
    m
  )
);

client.on(
  'guildMemberAdd',
  m => joinMonitor(
    client,
    m
  )
);

client.login(
  'MTM1MzM5MzE5NDQxNDYzNzE5OA.GdeWGI.JTZzWSofzKmx8eGepOQ_tY1Xw4RniNj4YXOv2s'
);
