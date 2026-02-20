const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, ChannelType, ActivityType, EmbedBuilder } = require('discord.js');
const express = require('express');

// --- 1. CONFIGURATION ---
const CONFIG = {
    SERVER_ID: '1195624668829327450',
    MODMAIL_CATEGORY_ID: '1473649458997624843',
    DASHBOARD_PASSWORD: '5538',
    ROBLOX_API_KEY: 'k8IvUAD+0kWzgw2O6KwO5A/DiOQwqvLHZ3qVJn5xypWm+mivZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SW1zNFNYWlZRVVFyTUd0WGVtZDNNazgyUzNkUE5VRXZSR2xQVVhkeGRreElXak54VmtwdU5YaDVjRmR0SzIxcGRpSXNJbTkzYm1WeVNXUWlPaUl5TkRjMk5ERTNOVEl6SWl3aVpYaHdJam94TnpjeE5qQXlNak14TENKcFlYUWlPakUzTnpFMU9UZzJNekVzSW01aVppSTZNVGMzTVRVNU9EWXpNWDAuSFRhbXpkNlBOanpnTUk2QmxNdnRCYzlqdkJ3ZXJoMENXZFVvX2s5NzkxV3BWVENrb3lQODVEWlRlMmVUdGRqNG54eThsLW9xVTFyR3dPM3JiOS12T2FvWXFZREh0enlGUUh5NkExVVZRRms1NnhNLXFFVXRDX293R25wU2ZaOFhzVGtQbXBTeWl4U0dhblJEYS1jeF9pNGd3ZExjZEduSk45TmJBWHFaMFd1LVcwN01OR2RVX0MwdGtaZDBjSUxDOWZMcUs5N2VDejZIZnNhbUwwSkxCenQ5eDE4bGh5a3BEZ1hGN0cwM0pJLS1IUGUyWWQ1ajRFSVZpSDdvOWhEeE1tQTJYWnl5SkxUX2lpSk5ESGJ6NUJVUmNUazUxR0JlNzA5Q084MVUtcmZBaGFsQ1RSTFMzdmh5UFZnZjFvQ3ROZ1IyZWtieDdlTWNGTVBUYTBvdFFR', 
    UNIVERSE_ID: '15806450151',
    MAINTENANCE_MODE: false,
    ADMIN_NAME: 'Administration Team',
    STATUS_TEXT: 'Watching DMs'
};

let auditLogs = [];
let activeRobloxServers = new Map();
const activeCreators = new Set();

function addLog(type, details) {
    auditLogs.unshift({ time: new Date().toLocaleTimeString(), type, details });
    if (auditLogs.length > 30) auditLogs.pop();
}

// --- 2. THE ADVANCED DASHBOARD ---
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Roblox Heartbeat
app.post('/roblox/heartbeat', (req, res) => {
    const { jobId, players, serverName } = req.body;
    activeRobloxServers.set(jobId, { name: serverName, players, lastSeen: Date.now() });
    res.sendStatus(200);
});

// Main Dashboard HTML
app.get('/dashboard', (req, res) => {
    const logHtml = auditLogs.map(l => `<tr><td>${l.time}</td><td><b>${l.type}</b></td><td>${l.details}</td></tr>`).join('');
    
    let robloxHtml = "";
    activeRobloxServers.forEach((data, id) => {
        robloxHtml += `
            <div class="card roblox-card">
                <h4>🎮 ${data.name} <small>(${id.substring(0,8)})</small></h4>
                <div class="player-list">
                    ${data.players.length > 0 ? data.players.map(p => `
                        <div class="player-item">
                            <span>${p.name}</span>
                            <button class="btn-danger" onclick="kickRoblox('${id}', '${p.id}')">KICK</button>
                        </div>
                    `).join('') : '<p>No players online.</p>'}
                </div>
            </div>`;
    });

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Xenon Pro | Cloud Management</title>
            <style>
                :root { --bg: #2f3136; --sidebar: #202225; --accent: #5865f2; --text: #ffffff; --danger: #ed4245; }
                body { font-family: 'Helvetica Neue', sans-serif; background: var(--bg); color: var(--text); display: flex; margin: 0; height: 100vh; overflow: hidden; }
                .sidebar { width: 260px; background: var(--sidebar); padding: 20px; display: flex; flex-direction: column; gap: 10px; }
                .sidebar h2 { color: var(--accent); text-align: center; margin-bottom: 20px; }
                .nav-btn { background: none; border: none; color: #b9bbbe; padding: 12px; text-align: left; font-size: 16px; cursor: pointer; border-radius: 5px; transition: 0.2s; }
                .nav-btn:hover, .nav-btn.active { background: #3c3f44; color: white; }
                .main { flex: 1; padding: 40px; overflow-y: auto; }
                .tab { display: none; } .tab.active { display: block; }
                .card { background: #36393f; padding: 20px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); margin-bottom: 20px; }
                input, select { background: #202225; color: white; border: 1px solid #444; padding: 10px; border-radius: 4px; width: 100%; margin-bottom: 10px; }
                button { background: var(--accent); color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold; }
                .btn-danger { background: var(--danger); }
                table { width: 100%; border-collapse: collapse; }
                th, td { text-align: left; padding: 10px; border-bottom: 1px solid #444; }
                .roblox-card { border-left: 4px solid #00a2ff; }
                .player-item { display: flex; justify-content: space-between; align-items: center; background: #2f3136; padding: 8px; margin: 5px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="sidebar">
                <h2>XENON PRO</h2>
                <button class="nav-btn active" onclick="show('general')">⚙️ General</button>
                <button class="nav-btn" onclick="show('roblox')">🎮 Roblox Cloud</button>
                <button class="nav-btn" onclick="show('modmail')">📬 Modmail</button>
                <button class="nav-btn" onclick="show('logs')">📜 Audit Logs</button>
            </div>
            <div class="main">
                <div id="general" class="tab active">
                    <h1>System Settings</h1>
                    <div class="card">
                        <form action="/update-settings" method="POST">
                            <label>Administration Team Name:</label>
                            <input type="text" name="adminName" value="${CONFIG.ADMIN_NAME}">
                            <label>Bot Status Text:</label>
                            <input type="text" name="statusText" value="${CONFIG.STATUS_TEXT}">
                            <label>Verify Changes (Password):</label>
                            <input type="password" name="password" required>
                            <button type="submit" name="action" value="toggle">Toggle Maintenance Mode</button>
                            <button type="submit" name="action" value="save" style="background:#43b581">Save Settings</button>
                        </form>
                    </div>
                </div>

                <div id="roblox" class="tab">
                    <h1>Roblox Experience Management</h1>
                    <div class="card">
                        <h3>Global Shout</h3>
                        <p>Send a message to all active servers:</p>
                        <input type="text" id="shoutMsg" placeholder="Type message here...">
                        <button onclick="globalShout()">Send Announcement</button>
                    </div>
                    <h3>Active Game Servers</h3>
                    <div id="robloxServers">${robloxHtml || "<p>No active servers.</p>"}</div>
                </div>

                <div id="logs" class="tab">
                    <h1>Action History</h1>
                    <div class="card">
                        <table>
                            <thead><tr><th>Time</th><th>Type</th><th>Details</th></tr></thead>
                            <tbody>${logHtml}</tbody>
                        </table>
                    </div>
                </div>
            </div>

            <script>
                function show(id) {
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                    document.getElementById(id).classList.add('active');
                    event.currentTarget.classList.add('active');
                }

                function kickRoblox(jobId, userId) {
                    const pass = prompt("Enter Password:");
                    if(!pass) return;
                    fetch('/roblox/kick', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ jobId, userId, password: pass })
                    }).then(() => alert("Kick command sent!"));
                }

                function globalShout() {
                    const msg = document.getElementById('shoutMsg').value;
                    const pass = prompt("Enter Password:");
                    fetch('/roblox/shout', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ message: msg, password: pass })
                    }).then(() => alert("Announcement sent!"));
                }
            </script>
        </body>
        </html>
    `);
});

// --- DASHBOARD POST ROUTES ---
app.post('/update-settings', (req, res) => {
    if (req.body.password !== CONFIG.DASHBOARD_PASSWORD) return res.send("Wrong password");
    CONFIG.ADMIN_NAME = req.body.adminName;
    CONFIG.STATUS_TEXT = req.body.statusText;
    if (req.body.action === 'toggle') CONFIG.MAINTENANCE_MODE = !CONFIG.MAINTENANCE_MODE;
    updateBotStatus();
    addLog("System", "Settings updated via Dashboard");
    res.redirect('/dashboard');
});

app.post('/roblox/kick', async (req, res) => {
    if (req.body.password !== CONFIG.DASHBOARD_PASSWORD) return res.sendStatus(403);
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${CONFIG.UNIVERSE_ID}/topics/GlobalKick`;
    await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': CONFIG.ROBLOX_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: JSON.stringify({ userId: req.body.userId }) })
    });
    addLog("Roblox", `Kicked User ID ${req.body.userId}`);
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
    addLog("Roblox", `Global Shout: ${req.body.message}`);
    res.sendStatus(200);
});

app.listen(3000);

// --- 3. DISCORD BOT LOGIC ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

function updateBotStatus() {
    if (CONFIG.MAINTENANCE_MODE) {
        client.user.setActivity('🛠️ Maintenance', { type: ActivityType.Custom });
        client.user.setStatus('dnd');
    } else {
        client.user.setActivity(CONFIG.STATUS_TEXT, { type: ActivityType.Watching });
        client.user.setStatus('online');
    }
}

client.once('ready', async () => {
    updateBotStatus();
    const guild = client.guilds.cache.get(CONFIG.SERVER_ID);
    if (guild) {
        await guild.commands.set([
            { name: 'kick', description: 'Kick a member', options: [{ name: 'user', type: 6, required: true }] },
            { name: 'ban', description: 'Ban a member', options: [{ name: 'user', type: 6, required: true }] },
            { name: 'warn', description: 'Warn a member', options: [{ name: 'user', type: 6, required: true }, { name: 'reason', type: 3, required: true }] },
            { name: 'clear', description: 'Clear messages', options: [{ name: 'amount', type: 4, required: true }] },
            { name: 'slowmode', description: 'Set slowmode', options: [{ name: 'seconds', type: 4, required: true }] },
            { name: 'ping', description: 'Check latency' },
            { name: 'areyouawake', description: 'Check status' }
        ]);
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
        if (CONFIG.MAINTENANCE_MODE) return message.reply("🛠️ Under Maintenance.");
        if (activeCreators.has(message.author.id)) return;

        const guild = client.guilds.cache.get(CONFIG.SERVER_ID);
        const category = guild.channels.cache.get(CONFIG.MODMAIL_CATEGORY_ID);
        let channel = guild.channels.cache.find(c => c.topic === `Modmail User ID: ${message.author.id}`);

        if (!channel) {
            activeCreators.add(message.author.id);
            try {
                channel = await guild.channels.create({
                    name: `mail-${message.author.username}`,
                    type: ChannelType.GuildText,
                    parent: category,
                    topic: `Modmail User ID: ${message.author.id}`
                });
                addLog("Modmail", `Opened for ${message.author.tag}`);
            } finally { activeCreators.delete(message.author.id); }
        }
        await channel.send(`**${message.author.username}:** ${message.content}`);
    }

    if (message.content.startsWith('!reply ') && message.channel.parentId === CONFIG.MODMAIL_CATEGORY_ID) {
        const userId = message.channel.topic?.split(': ')[1];
        const user = await client.users.fetch(userId);
        await user.send(`**${CONFIG.ADMIN_NAME}:** ${message.content.replace('!reply ', '')}`);
        message.react('✅');
    }

    if (message.content === '!close' && message.channel.parentId === CONFIG.MODMAIL_CATEGORY_ID) {
        await message.channel.send("Closing...");
        setTimeout(() => message.channel.delete(), 2000);
    }
});

client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    if (CONFIG.MAINTENANCE_MODE && !['ping', 'areyouawake'].includes(i.commandName)) {
        return i.reply({ content: "Maintenance Mode is active.", ephemeral: true });
    }

    if (i.commandName === 'slowmode') {
        const sec = i.options.getInteger('seconds');
        await i.channel.setRateLimitPerUser(sec);
        addLog("Mod", `Slowmode set to ${sec}s in ${i.channel.name}`);
        return i.reply(`Slowmode set to ${sec} seconds.`);
    }

    if (i.commandName === 'warn') {
        const target = i.options.getUser('user');
        const reason = i.options.getString('reason');
        addLog("Warn", `${target.tag} warned: ${reason}`);
        await i.reply(`Warned ${target.tag}.`);
    }

    if (i.commandName === 'ping') i.reply(`Latency: ${client.ws.ping}ms`);
});

client.login(process.env.TOKEN);
