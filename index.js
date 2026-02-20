// 1. POLYFILL FOR FETCH (Required for Node 18+ and Render environments)
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, ChannelType, ActivityType, EmbedBuilder } = require('discord.js');
const express = require('express');

// --- 2. CONFIGURATION ---
const CONFIG = {
    SERVER_ID: '1195624668829327450',
    MODMAIL_CATEGORY_ID: '1473649458997624843',
    DASHBOARD_PASSWORD: '5538',
    // Your provided API Key
    ROBLOX_API_KEY: 'k8IvUAD+0kWzgw2O6KwO5A/DiOQwqvLHZ3qVJn5xypWm+mivZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SW1zNFNYWlZRVVFyTUd0WGVtZDNNazgyUzNkUE5VRXZSR2xQVVhkeGRreElXak54VmtwdU5YaDVjRmR0SzIxcGRpSXNJbTkzYm1TeVNXUWlPaUl5TkRjMk5ERTNOVEl6SWl3aVpYaHdJam94TnpjeE5qQXlNak14TENKcFlYUWlPakUzTnpFMU9UZzJNekVzSW01aVppSTZNVGMzTVRVNU9EWXpNWDAuSFRhbXpkNlBOanpnTUk2QmxNdnRCYzlqdkJ3ZXJoMENXZFVvX2s5NzkxV3BWVENrb3lQODVEWlRlMmVUdGRqNG54eThsLW9xVTFyR3dPM3JiOS12T2FvWXFZREh0enlGUUh5NkExVVZRRms1NnhNLXFFVXRDX293R25wU2ZaOFhzVGtQbXBTeWl4U0dhblJEYS1jeF9pNGd3ZExjZEduSk45TmJBWHFaMFd1LVcwN01OR2RVX0MwdGtaZDBjSUxDOWZMcUs5N2VDejZIZnNhbUwwSkxCenQ5eDE4bGh5a3BEZ1hGN0cwM0pJLS1IUGUyWWQ1ajRFSVZpSDdvOWhEeE1tQTJYWnl5SkxUX2lpSk5ESGJ6NUJVUmNUazUxR0JlNzA5Q084MVUtcmZBaGFsQ1RSTFMzdmh5UFZnZjFvQ3ROZ1IyZWtieDdlTWNGTVBUYTBvdFFR',
    UNIVERSE_ID: '15806450151',
    ADMIN_NAME: 'Administration Team',
    STATUS_TEXT: 'Watching DMs'
};

let activeRobloxServers = new Map();
const activeCreators = new Set();

// --- 3. EXPRESS DASHBOARD ---
const app = express();
app.use(express.json()); // Essential for Roblox Heartbeat

// Roblox Heartbeat
app.post('/roblox/heartbeat', (req, res) => {
    const { jobId, players, serverName } = req.body;
    if (!jobId) return res.sendStatus(400);
    
    activeRobloxServers.set(jobId, {
        name: serverName || "Game Server",
        players: players || [],
        lastSeen: Date.now()
    });
    res.sendStatus(200);
});

// Dashboard UI
app.get('/dashboard', (req, res) => {
    let robloxHtml = "";
    activeRobloxServers.forEach((data, id) => {
        robloxHtml += `
            <div style="background:#36393f; padding:15px; margin:10px; border-radius:8px; border-left: 4px solid #00a2ff;">
                <h4>🎮 ${data.name} <small>(${id.substring(0,8)})</small></h4>
                ${data.players.map(p => `
                    <div style="display:flex; justify-content:space-between; margin:5px 0;">
                        <span>${p.name}</span>
                        <button onclick="kick('${id}','${p.id}')" style="background:#ed4245; color:white; border:none; border-radius:3px; cursor:pointer;">KICK</button>
                    </div>
                `).join('')}
            </div>`;
    });

    res.send(`
        <html>
            <head><title>Xenon Pro</title></head>
            <body style="background:#2f3136; color:white; font-family:sans-serif; padding:20px;">
                <h1>Xenon Pro Cloud</h1>
                <div style="background:#36393f; padding:15px; border-radius:8px; margin-bottom:20px;">
                    <h3>Global Shout</h3>
                    <input type="text" id="msg" style="width:70%; padding:8px;">
                    <button onclick="shout()" style="padding:8px; background:#5865f2; color:white; border:none; cursor:pointer;">SEND</button>
                </div>
                <h2>Active Servers</h2>
                ${robloxHtml || "<p>No servers online.</p>"}
                <script>
                    function kick(j, u) {
                        const p = prompt("Password:");
                        fetch('/roblox/kick', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({jobId:j, userId:u, password:p})
                        }).then(() => alert("Command Sent"));
                    }
                    function shout() {
                        const m = document.getElementById('msg').value;
                        const p = prompt("Password:");
                        fetch('/roblox/shout', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({message:m, password:p})
                        }).then(() => alert("Shout Sent"));
                    }
                </script>
            </body>
        </html>
    `);
});

// Outbound to Roblox
app.post('/roblox/kick', async (req, res) => {
    if (req.body.password !== CONFIG.DASHBOARD_PASSWORD) return res.sendStatus(403);
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${CONFIG.UNIVERSE_ID}/topics/GlobalKick`;
    await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': CONFIG.ROBLOX_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: JSON.stringify({ userId: req.body.userId }) })
    });
    res.sendStatus(200);
});

app.post('/roblox/shout', async (req, res) => {
    if (req.body.password !== CONFIG.DASHBOARD_PASSWORD) return res.sendStatus(403);
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${CONFIG.UNIVERSE_ID}/topics/GlobalShout`;
    await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': CONFIG.ROBLOX_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: req.body.message })
    });
    res.sendStatus(200);
});

// --- 4. DISCORD BOT ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    app.listen(3000, () => console.log("🌐 Dashboard running on port 3000"));
});

// Modmail Logic
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
        const guild = client.guilds.cache.get(CONFIG.SERVER_ID);
        const category = guild.channels.cache.get(CONFIG.MODMAIL_CATEGORY_ID);
        let channel = guild.channels.cache.find(c => c.topic === `Modmail User ID: ${message.author.id}`);

        if (!channel) {
            channel = await guild.channels.create({
                name: `mail-${message.author.username}`,
                type: ChannelType.GuildText,
                parent: category,
                topic: `Modmail User ID: ${message.author.id}`
            });
        }
        await channel.send(`**${message.author.username}:** ${message.content}`);
    }

    if (message.content.startsWith('!reply ') && message.channel.parentId === CONFIG.MODMAIL_CATEGORY_ID) {
        const userId = message.channel.topic?.split(': ')[1];
        const user = await client.users.fetch(userId);
        await user.send(`**${CONFIG.ADMIN_NAME}:** ${message.content.replace('!reply ', '')}`);
        message.react('✅');
    }
});

// Global Error Catch to prevent "Exited with status 1"
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

client.login(process.env.TOKEN);
