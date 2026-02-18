const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// 1. KEEP-ALIVE SERVER
const app = express();
app.get('/', (req, res) => res.send('Bot is awake!'));
app.listen(3000, () => console.log('Web server is ready.'));

// 2. DISCORD BOT SETUP
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on('messageCreate', async (message) => {
  if (message.content === '/ping') {
    const sent = await message.channel.send('Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);
    
    sent.edit(`🏓 Pong!\n**Latency:** ${latency}ms\n**API:** ${apiLatency}ms`);
  }
});

client.login(process.env.TOKEN);
