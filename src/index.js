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

// Monthly review cron — 1st of every month at 09:00 UTC
cron.schedule('0 9 1 * *', async () => {
  console.log('[cron] Running monthly reviews...');
  const { sendMonthlyReviews } = require('./commands/review');
  const count = await sendMonthlyReviews(client).catch(err => { console.error('[cron]', err); return 0; });
  console.log(`[cron] Monthly reviews sent: ${count}`);
});

// Global error handling — prevent worker crash
process.on('unhandledRejection', err => console.error('[unhandledRejection]', err));
process.on('uncaughtException',  err => console.error('[uncaughtException]', err));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB Atlas');
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
});
