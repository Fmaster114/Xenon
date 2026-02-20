const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, ChannelType, ActivityType } = require('discord.js');
const express = require('express');

// --- 1. CONFIGURATION ---
const CONFIG = {
    SERVER_ID: '1195624668829327450',
    DASHBOARD_PASSWORD: 'YourSecretPassword123',
    ROBLOX_API_KEY: 'k8IvUAD+0kWzgw2O6KwO5A/DiOQwqvLHZ3qVJn5xypWm+mivZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNkluTnBaeTB5TURJeExUQTNMVEV6VkRFNE9qVXhPalE1V2lJc0luUjVjQ0k2SWtwWFZDSjkuZXlKaGRXUWlPaUpTYjJKc2IzaEpiblJsY201aGJDSXNJbWx6Y3lJNklrTnNiM1ZrUVhWMGFHVnVkR2xqWVhScGIyNVRaWEoyYVdObElpd2lZbUZ6WlVGd2FVdGxlU0k2SW1zNFNYWlZRVVFyTUd0WGVtZDNNazgyUzNkUE5VRXZSR2xQVVhkeGRreElXak54VmtwdU5YaDVjRmR0SzIxcGRpSXNJbTkzYm1WeVNXUWlPaUl5TkRjMk5ERTNOVEl6SWl3aVpYaHdJam94TnpjeE5qQXlNak14TENKcFlYUWlPakUzTnpFMU9UZzJNekVzSW01aVppSTZNVGMzTVRVNU9EWXpNWDAuSFRhbXpkNlBOanpnTUk2QmxNdnRCYzlqdkJ3ZXJoMENXZFVvX2s5NzkxV3BWVENrb3lQODVEWlRlMmVUdGRqNG54eThsLW9xVTFyR3dPM3JiOS12T2FvWXFZREh0enlGUUh5NkExVVZRRms1NnhNLXFFVXRDX293R25wU2ZaOFhzVGtQbXBTeWl4U0dhblJEYS1jeF9pNGd3ZExjZEduSk45TmJBWHFaMFd1LVcwN01OR2RVX0MwdGtaZDBjSUxDOWZMcUs5N2VDejZIZnNhbUwwSkxCenQ5eDE4bGh5a3BEZ1hGN0cwM0pJLS1IUGUyWWQ1ajRFSVZpSDdvOWhEeE1tQTJYWnl5SkxUX2lpSk5ESGJ6NUJVUmNUazUxR0JlNzA5Q084MVUtcmZBaGFsQ1RSTFMzdmh5UFZnZjFvQ3ROZ1IyZWtieDdlTWNGTVBUYTBvdFFR', // Get this from Roblox Creator Dashboard
    UNIVERSE_ID: '15806450151', // Your Roblox Universe ID
    MAINTENANCE_MODE: false,
    ADMIN_NAME: 'Administration Team'
};

let auditLogs = [];
let activeRobloxServers = new Map(); // Stores active JobIDs and player lists

// --- 2. THE CATEGORIZED DASHBOARD ---
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Roblox Heartbeat Endpoint (Roblox calls this)
app.post('/roblox/heartbeat', (req, res) => {
    const { jobId, players, serverName } = req.body;
    activeRobloxServers.set(jobId, {
        name: serverName || "Main Server",
        players: players, // Array of {name: string, id: number}
        lastSeen: Date.now()
    });
    res.sendStatus(200);
});

app.get('/dashboard', (req, res) => {
    const logHtml = auditLogs.map(l => `<li>[${l.time}] ${l.details}</li>`).join('');
    
    // Generate Roblox Server Cards
    let robloxHtml = "";
    activeRobloxServers.forEach((data, id) => {
        robloxHtml += `
            <div class="card" style="border-left-color: #00a2ff;">
                <h4>Server: ${data.name} (${id.substring(0,8)})</h4>
                <ul>${data.players.map(p => `
                    <li>${p.name} 
                        <button onclick="kickRoblox('${id}', '${p.id}')" style="background:red; padding:2px 5px; font-size:10px;">KICK</button>
                    </li>`).join('')}
                </ul>
            </div>`;
    });

    res.send(`
        <html>
            <head>
                <title>Xenon Cloud Panel</title>
                <style>
                    body { font-family: sans-serif; background: #2c2f33; color: white; display: flex; margin: 0; }
                    .sidebar { width: 200px; background: #23272a; height: 100vh; padding: 20px; border-right: 1px solid #444; }
                    .main { flex: 1; padding: 20px; overflow-y: scroll; }
                    .card { background: #2f3136; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 5px solid #7289da; }
                    .nav-btn { display: block; width: 100%; padding: 10px; background: none; border: none; color: #b9bbbe; text-align: left; cursor: pointer; }
                    .nav-btn:hover { background: #3c3f44; color: white; }
                </style>
            </head>
            <body>
                <div class="sidebar">
                    <h2>Xenon</h2>
                    <button class="nav-btn" onclick="show('general')">⚙️ General Settings</button>
                    <button class="nav-btn" onclick="show('roblox')">🎮 Roblox Servers</button>
                    <button class="nav-btn" onclick="show('logs')">📜 Audit Logs</button>
                </div>
                <div class="main">
                    <div id="general" class="tab">
                        <h1>General Settings</h1>
                        <div class="card">
                            <form action="/update-settings" method="POST">
                                <label>Maintenance Mode:</label> ${CONFIG.MAINTENANCE_MODE ? "ON" : "OFF"}<br>
                                <input type="password" name="password" placeholder="Dashboard Password" required><br>
                                <button type="submit" name="action" value="toggle">Toggle Maintenance</button>
                            </form>
                        </div>
                    </div>
                    <div id="roblox" class="tab" style="display:none;">
                        <h1>Active Roblox Servers</h1>
                        ${robloxHtml || "<p>No active servers detected.</p>"}
                    </div>
                    <div id="logs" class="tab" style="display:none;">
                        <h1>Logs</h1>
                        <div class="card">${logHtml}</div>
                    </div>
                </div>
                <script>
                    function show(id) {
                        document.querySelectorAll('.tab').forEach(t => t.style.display = 'none');
                        document.getElementById(id).style.display = 'block';
                    }
                    function kickRoblox(jobId, userId) {
                        const pass = prompt("Enter Dashboard Password to Kick:");
                        fetch('/roblox/kick', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ jobId, userId, password: pass })
                        }).then(() => alert("Kick command sent!"));
                    }
                </script>
            </body>
        </html>
    `);
});

// Kick logic using Roblox OpenCloud
app.post('/roblox/kick', async (req, res) => {
    if (req.body.password !== CONFIG.DASHBOARD_PASSWORD) return res.sendStatus(403);
    
    // This sends a message to Roblox via MessagingService API
    const url = `https://apis.roblox.com/messaging-service/v1/universes/${CONFIG.UNIVERSE_ID}/topics/GlobalKick`;
    await fetch(url, {
        method: 'POST',
        headers: { 'x-api-key': CONFIG.ROBLOX_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: JSON.stringify({ userId: req.body.userId }) })
    });
    res.sendStatus(200);
});

app.listen(3000);
// (Rest of the bot client.login and events remain the same)
