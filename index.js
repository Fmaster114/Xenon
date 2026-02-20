const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, ChannelType, ActivityType, EmbedBuilder } = require('discord.js');
const express = require('express');

// --- 1. CONFIGURATION ---
const CONFIG = {
    SERVER_ID: '1195624668829327450',
    MODMAIL_CATEGORY_ID: '1473649458997624843',
    DASHBOARD_PASSWORD: '5538',
    ROBLOX_API_KEY: 'k8IvUAD+0kWzgw2O6KwO5A/DiOQwqvLHZ3qVJn5xypWm+mivZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SW1zNFNYWlZRVVFyTUd0WGVtZDNNazgyUzNkUE5VRXZSR2xQVVhkeGRreElXak54VmtwdU5YaDVjRmR0SzIxcGRpSXNJbTkzYm1TeVNXUWlPaUl5TkRjMk5ERTNOVEl6SWl3aVpYaHdJam94TnpjeE5qQXlNak14TENKcFlYUWlPakUzTnpFMU9UZzJNekVzSW01aVppSTZNVGMzTVRVNU9EWXpNWDAuSFRhbXpkNlBOanpnTUk2QmxNdnRCYzlqdkJ3ZXJoMENXZFVvX2s5NzkxV3BWVENrb3lQODVEWlRlMmVUdGRqNG54eThsLW9xVTFyR3dPM3JiOS12T2FvWXFZREh0enlGUUh5NkExVVZRRms1NnhNLXFFVXRDX293R25wU2ZaOFhzVGtQbXBTeWl4U0dhblJEYS1jeF9pNGd3ZExjZEduSk45TmJBWHFaMFd1LVcwN01OR2RVX0MwdGtaZDBjSUxDOWZMcUs5N2VDejZIZnNhbUwwSkxCenQ5eDE4bGh5a3BEZ1hGN0cwM0pJLS1IUGUyWWQ1ajRFSVZpSDdvOWhEeE1tQTJYWnl5SkxUX2lpSk5ESGJ6NUJVUmNUazUxR0JlNzA5Q084MVUtcmZBaGFsQ1RSTFMzdmh5UFZnZjFvQ3ROZ1IyZWtieDdlTWNGTVBUYTBvdFFR',
    UNIVERSE_ID: '15806450151',
    ADMIN_NAME: 'Administration Team',
    STATUS_TEXT: 'Xenon | v2.0'
};

const START_TIME = Date.now();
let auditLogs = [];
let activeRobloxServers = new Map();
const activeCreators = new Set();

function addLog(type, details) {
    auditLogs.unshift({ time: new Date().toLocaleTimeString(), type, details });
    if (auditLogs.length > 50) auditLogs.pop();
}

// --- 2. EXPRESS API & DASHBOARD ---
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Roblox Heartbeat Endpoint
app.post('/roblox/heartbeat', (req, res) => {
    const { jobId, players, serverName } = req.body;
    if (!jobId) return res.status(400).send({ error: "Missing JobId" });
    
    activeRobloxServers.set(jobId, {
        name: serverName || "Game Server",
        players: players || [],
        lastSeen: Date.now()
    });

    // Cleanup dead servers (No ping in 2 mins)
    for (const [id, data] of activeRobloxServers) {
        if (Date.now() - data.lastSeen > 120000) activeRobloxServers.delete(id);
    }
    res.sendStatus(200);
});

// Outbound API Requests to Roblox OpenCloud
async function sendRobloxMessage(topic, messageData) {
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${CONFIG.UNIVERSE_ID}/topics/${topic}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': CONFIG.ROBLOX_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: typeof messageData === 'string' ? messageData : JSON.stringify(messageData) })
    });
    return response.ok;
}

// Dashboard Endpoints
app.post('/api/action', async (req, res) => {
    if (req.body.password !== CONFIG.DASHBOARD_PASSWORD) return res.status(403).json({ success: false, msg: "Bad Auth" });
    
    let success = false;
    if (req.body.action === 'kick') {
        success = await sendRobloxMessage('GlobalKick', { userId: req.body.userId });
        if (success) addLog("Moderation", `Kicked User ID ${req.body.userId}`);
    } else if (req.body.action === 'shout') {
        success = await sendRobloxMessage('GlobalShout', req.body.message);
        if (success) addLog("Announcement", `Shout: ${req.body.message}`);
    } else if (req.body.action === 'shutdown') {
        success = await sendRobloxMessage('ServerShutdown', { jobId: req.body.jobId });
        if (success) addLog("System", `Requested shutdown for server ${req.body.jobId.substring(0,8)}`);
    }

    res.json({ success });
});

// The UI
app.get('/dashboard', (req, res) => {
    const uptime = Math.floor((Date.now() - START_TIME) / 60000);
    const totalPlayers = Array.from(activeRobloxServers.values()).reduce((acc, curr) => acc + curr.players.length, 0);

    let robloxHtml = "";
    activeRobloxServers.forEach((data, id) => {
        robloxHtml += `
            <div class="server-card">
                <div class="server-header">
                    <h4>🎮 ${data.name} <span class="badge">${data.players.length} Players</span></h4>
                    <button class="btn-warn" onclick="doAction('shutdown', {jobId: '${id}'})">Shutdown Server</button>
                </div>
                <div class="player-list">
                    ${data.players.map(p => `
                        <div class="player-item">
                            <span><b>${p.name}</b> <small style="color:#888;">(${p.id})</small></span>
                            <button class="btn-danger" onclick="doAction('kick', {userId: '${p.id}'})">Kick</button>
                        </div>
                    `).join('') || '<p style="color:#aaa;">No players currently online.</p>'}
                </div>
            </div>`;
    });

    const logHtml = auditLogs.map(l => `<tr><td style="color:#888">${l.time}</td><td><span class="badge">${l.type}</span></td><td>${l.details}</td></tr>`).join('');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Xenon Pro | Ultimate Console</title>
            <style>
                :root { --bg: #1e1e24; --panel: #2b2b36; --accent: #5865f2; --text: #e0e0e0; --danger: #ed4245; --warn: #faa61a; --success: #43b581; }
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 20px; }
                .header-stats { display: flex; gap: 20px; margin-bottom: 20px; }
                .stat-box { background: var(--panel); padding: 20px; border-radius: 12px; flex: 1; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.2); border-bottom: 3px solid var(--accent); }
                .stat-box h2 { margin: 0; font-size: 2rem; color: #fff; }
                .panel { background: var(--panel); padding: 25px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.2); }
                .server-card { background: #32323e; border-radius: 8px; margin-bottom: 15px; overflow: hidden; }
                .server-header { background: #25252e; padding: 15px; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--success); }
                .server-header h4 { margin: 0; font-size: 1.1rem; }
                .player-list { padding: 15px; max-height: 300px; overflow-y: auto; }
                .player-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #2b2b36; border-radius: 6px; margin-bottom: 8px; border: 1px solid #3e3e4f; }
                .badge { background: #404052; padding: 4px 8px; border-radius: 12px; font-size: 0.8rem; margin-left: 10px; }
                input[type="text"] { width: 70%; padding: 12px; background: #1e1e24; border: 1px solid #444; color: white; border-radius: 6px; }
                button { padding: 10px 20px; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; transition: 0.2s; color: white; }
                button:hover { filter: brightness(1.2); }
                .btn-primary { background: var(--accent); }
                .btn-danger { background: var(--danger); }
                .btn-warn { background: var(--warn); color: black; }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 12px; border-bottom: 1px solid #3e3e4f; }
            </style>
        </head>
        <body>
            <h1>⚡ Xenon Pro Console</h1>
            <div class="header-stats">
                <div class="stat-box"><h2>${uptime}m</h2><p>Bot Uptime</p></div>
                <div class="stat-box"><h2>${activeRobloxServers.size}</h2><p>Active Servers</p></div>
                <div class="stat-box"><h2>${totalPlayers}</h2><p>Total Players</p></div>
            </div>

            <div class="panel">
                <h3>📢 Global Announcement</h3>
                <div style="display: flex; gap: 10px;">
                    <input type="text" id="shoutMsg" placeholder="Type an announcement to broadcast to all servers...">
                    <button class="btn-primary" onclick="doAction('shout', {message: document.getElementById('shoutMsg').value})">Broadcast</button>
                </div>
            </div>

            <div class="panel">
                <h3>🎮 Live Roblox Servers</h3>
                ${robloxHtml || "<p style='color:#aaa;'>Waiting for server heartbeats...</p>"}
            </div>

            <div class="panel">
                <h3>📜 Audit Logs</h3>
                <table>${logHtml || "<tr><td>No logs yet.</td></tr>"}</table>
            </div>

            <script>
                async function doAction(action, payload) {
                    const pass = prompt("Enter Admin Password:");
                    if (!pass) return;
                    payload.action = action;
                    payload.password = pass;
                    
                    const res = await fetch('/api/action', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert("✅ Command executed successfully!");
                        location.reload();
                    } else {
                        alert("❌ Failed: Incorrect password or API error.");
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// --- 3. DISCORD BOT COMMANDS & LOGIC ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.DirectMessages, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

client.once('ready', async () => {
    console.log(`✅ DISCORD: Logged in as ${client.user.tag}`);
    client.user.setActivity(CONFIG.STATUS_TEXT, { type: ActivityType.Watching });
    
    // Deploy Commands
    const guild = client.guilds.cache.get(CONFIG.SERVER_ID);
    if (guild) {
        await guild.commands.set([
            { name: 'ping', description: 'Check bot latency' },
            { name: 'status', description: 'View connected Roblox servers' },
            { name: 'kick', description: 'Kick a user from Discord', options: [{ name: 'user', type: 6, description: 'User', required: true }, { name: 'reason', type: 3, description: 'Reason', required: false }] },
            { name: 'ban', description: 'Ban a user from Discord', options: [{ name: 'user', type: 6, description: 'User', required: true }, { name: 'reason', type: 3, description: 'Reason', required: false }] },
            { name: 'timeout', description: 'Timeout a user', options: [{ name: 'user', type: 6, description: 'User', required: true }, { name: 'minutes', type: 4, description: 'Duration in minutes', required: true }] },
            { name: 'clear', description: 'Clear chat messages', options: [{ name: 'amount', type: 4, description: 'Amount (1-100)', required: true }] },
            { name: 'lock', description: 'Lock the current channel' },
            { name: 'unlock', description: 'Unlock the current channel' }
        ]);
        console.log(`✅ DISCORD: Commands synced!`);
    }
    app.listen(3000, () => console.log("🌐 WEB: Dashboard running on port 3000"));
});

// Slash Command Handler
client.on('interactionCreate', async (i) => {
    if (!i.isChatInputCommand()) return;
    
    // Permissions check for mod commands
    const modCommands = ['kick', 'ban', 'timeout', 'clear', 'lock', 'unlock'];
    if (modCommands.includes(i.commandName) && !i.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return i.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }

    try {
        if (i.commandName === 'ping') await i.reply(`🏓 Pong! Latency: ${client.ws.ping}ms`);
        
        if (i.commandName === 'status') {
            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('📊 System Status')
                .addFields(
                    { name: 'Active Roblox Servers', value: `${activeRobloxServers.size}`, inline: true },
                    { name: 'Discord Latency', value: `${client.ws.ping}ms`, inline: true }
                )
                .setTimestamp();
            await i.reply({ embeds: [embed] });
        }

        if (i.commandName === 'clear') {
            const amount = i.options.getInteger('amount');
            if (amount < 1 || amount > 100) return i.reply({ content: 'Must be between 1 and 100.', ephemeral: true });
            await i.channel.bulkDelete(amount, true);
            await i.reply({ content: `✅ Cleared ${amount} messages.`, ephemeral: true });
            addLog('Discord Mod', `${i.user.tag} cleared ${amount} messages in #${i.channel.name}`);
        }

        if (i.commandName === 'lock') {
            await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false });
            await i.reply('🔒 Channel Locked.');
            addLog('Discord Mod', `${i.user.tag} locked #${i.channel.name}`);
        }

        if (i.commandName === 'unlock') {
            await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null });
            await i.reply('🔓 Channel Unlocked.');
            addLog('Discord Mod', `${i.user.tag} unlocked #${i.channel.name}`);
        }

        if (i.commandName === 'timeout') {
            const target = i.options.getMember('user');
            const mins = i.options.getInteger('minutes');
            if (!target) return i.reply('User not found.');
            await target.timeout(mins * 60 * 1000, `Timed out by ${i.user.tag}`);
            await i.reply(`✅ ${target.user.tag} has been timed out for ${mins} minutes.`);
            addLog('Discord Mod', `${target.user.tag} timed out for ${mins}m`);
        }
    } catch (error) {
        console.error("Command Error:", error);
        await i.reply({ content: '❌ An error occurred executing that command.', ephemeral: true }).catch(()=>{});
    }
});

// Modmail Handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
        const guild = client.guilds.cache.get(CONFIG.SERVER_ID);
        if(!guild) return;
        const category = guild.channels.cache.get(CONFIG.MODMAIL_CATEGORY_ID);
        let channel = guild.channels.cache.find(c => c.topic === `Modmail User ID: ${message.author.id}`);

        if (!channel) {
            channel = await guild.channels.create({
                name: `mail-${message.author.username}`,
                type: ChannelType.GuildText,
                parent: category,
                topic: `Modmail User ID: ${message.author.id}`
            });
            const embed = new EmbedBuilder().setColor('#43b581').setTitle('New Modmail Ticket').setDescription(`User: ${message.author.tag}`);
            await channel.send({ embeds: [embed] });
            addLog('Modmail', `Opened ticket for ${message.author.tag}`);
        }
        await channel.send(`**[USER] ${message.author.username}:** ${message.content}`);
    }

    // Admin Reply Logic inside Discord Server
    if (message.content.startsWith('!reply ') && message.channel.parentId === CONFIG.MODMAIL_CATEGORY_ID) {
        const userId = message.channel.topic?.split(': ')[1];
        if(!userId) return;
        try {
            const user = await client.users.fetch(userId);
            await user.send(`**[${CONFIG.ADMIN_NAME}]:** ${message.content.replace('!reply ', '')}`);
            await message.react('✅');
        } catch(e) {
            await message.reply("❌ Could not DM user. They may have closed their DMs.");
        }
    }

    if (message.content === '!close' && message.channel.parentId === CONFIG.MODMAIL_CATEGORY_ID) {
        await message.channel.send("🔒 Closing ticket in 3 seconds...");
        setTimeout(() => message.channel.delete().catch(()=>{}), 3000);
        addLog('Modmail', `Closed ticket in ${message.channel.name}`);
    }
});

// Crash Protection Catch-All
process.on('unhandledRejection', error => console.error('CRASH PREVENTED (Unhandled Rejection):', error));
process.on('uncaughtException', error => console.error('CRASH PREVENTED (Uncaught Exception):', error));

client.login(process.env.TOKEN);
