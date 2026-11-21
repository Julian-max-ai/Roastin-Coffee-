'use strict';
require('dotenv').config();
const http = require('http');
http.createServer((_, res) => res.end('OK')).listen(process.env.PORT || 3000);

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const mongoose = require('mongoose');
const fs   = require('fs');
const path = require('path');
const cron = require('node-cron');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
client.commands = new Collection();

// Load commands
for (const file of fs.readdirSync(path.join(__dirname, 'commands')).filter(f => f.endsWith('.js'))) {
  const cmd = require(path.join(__dirname, 'commands', file));
  if (cmd.data && cmd.execute) client.commands.set(cmd.data.name, cmd);
}

// Load events
for (const file of fs.readdirSync(path.join(__dirname, 'events')).filter(f => f.endsWith('.js'))) {
  const ev = require(path.join(__dirname, 'events', file));
  client[ev.once ? 'once' : 'on'](ev.name, (...args) => ev.execute(...args, client));
}

// Global error handling — prevent worker crash
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));
process.on('uncaughtException',  err => console.error('[uncaughtException]', err));

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB Atlas');
    const { runMigrations } = require('./utils/migration');
    await runMigrations().catch(err => console.error('[migration]', err));
    client.login(process.env.DISCORD_TOKEN);
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  const { startScheduler } = require('./scheduler');
  startScheduler(client);
  const { runCatchup } = require('./scheduler/catchup');
  await runCatchup(client).catch(err => console.error('[catchup]', err));

  // Populate branding cache
  try {
    const GuildConfig = require('./models/GuildConfig');
    const configs = await GuildConfig.find({ branding: { $ne: null } }).catch(() => []);
    for (const cfg of configs) {
      require('./utils/brandingCache').set(cfg.guildId, cfg.branding);
    }
  } catch {}
});
