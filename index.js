const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, ChannelType, ActivityType } = require('discord.js');
const express = require('express');

// --- 1. CONFIGURATION & STATE ---
const CONFIG = {
    SERVER_ID: '1195624668829327450',
    MODMAIL_CATEGORY_ID: '1473649458997624843',
    STAFF_ROLE_ID: '1473649483836297327',
    DASHBOARD_PASSWORD: '55368', // <--- CHANGE THIS!
    MAINTENANCE_MODE: false,
    STATUS_TEXT: 'Watching DMs',
    ADMIN_NAME: 'Administration Team'
};

// This stores the last 20 actions in memory
let auditLogs = []; 
const activeCreators = new Set();

function addLog(action, details) {
    const logEntry = {
        time: new Date().toLocaleTimeString(),
        action: action,
        details: details
    };
    auditLogs.unshift(logEntry); // Add to top
    if (auditLogs.length > 20) auditLogs.pop(); // Keep only last 20
}

// --- 2. THE ADVANCED DASHBOARD ---
const app = express();
app.use(express.urlencoded({ extended: true }));

app.get('/dashboard', (req, res) => {
    const logHtml = auditLogs.map(l => `<li>[${l.time}] <b>${l.action}</b>: ${l.details}</li>`).join('') || "No logs yet.";
    
    res.send(`
        <html>
            <head>
                <title>Xenon Pro Dashboard</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                    body { font-family: 'Segoe UI', sans-serif; background: #2c2f33; color: white; padding: 20px; }
                    .container { max-width: 800px; margin: auto; }
                    .card { background: #23272a; padding: 20px; border-radius: 10px; margin-bottom: 20px; border-left: 5px solid #7289da; }
                    .status-on { color: #43b581; } .status-off { color: #f04747; }
                    input, button { padding: 10px; border-radius: 5px; border: none; margin: 5px 0; }
                    button { background: #7289da; color: white; cursor: pointer; font-weight: bold; }
                    .logs { background: #1e2124; padding: 15px; border-radius: 5px; height: 200px; overflow-y: scroll; font-family: monospace; list-style: none; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Xenon Pro Control Panel</h1>
                    
                    <div class="card">
                        <h3>Bot Controls</h3>
                        <p>Status: <b class="${CONFIG.MAINTENANCE_MODE ? 'status-off' : 'status-on'}">${CONFIG.MAINTENANCE_MODE ? "🛠️ MAINTENANCE" : "✅ ONLINE"}</b></p>
                        <form action="/update-settings" method="POST">
                            <label>Admin Team Name:</label><br>
                            <input type="text" name="adminName" value="${CONFIG.ADMIN_NAME}"><br>
                            <label>Status Message:</label><br>
                            <input type="text" name="statusText" value="${CONFIG.STATUS_TEXT}"><br>
                            <label>Password to Save Changes:</label><br>
                            <input type="password" name="password" required><br>
                            <button type="submit" name="action" value="toggle">Toggle Maintenance</button>
                            <button type="submit" name="action" value="save" style="background: #43b581;">Save Settings Only</button>
                        </form>
                    </div>

                    <div class="card" style="border-left-color: #faa61a;">
                        <h3>Recent Audit Logs (Last 20 Actions)</h3>
                        <ul class="logs">${logHtml}</ul>
                    </div>
                </div>
            </body>
        </html>
    `);
});

app.post('/update-settings', (req, res) => {
    if (req.body.password !== CONFIG.DASHBOARD_PASSWORD) return res.send("Invalid Password.");
    
    CONFIG.ADMIN_NAME = req.body.adminName;
    CONFIG.STATUS_TEXT = req.body.statusText;
    
    if (req.body.action === 'toggle') {
        CONFIG.MAINTENANCE_MODE = !CONFIG.MAINTENANCE_MODE;
        addLog("System", `Maintenance Mode toggled to ${CONFIG.MAINTENANCE_MODE}`);
    } else {
        addLog("System", "Settings updated via Dashboard");
    }

    updateBotStatus();
    res.redirect('/dashboard');
});

app.listen(3000);

// --- 3. BOT SETUP ---
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

// --- 4. COMMANDS & MODMAIL ---
client.once('ready', async () => {
    updateBotStatus();
    const guild = client.guilds.cache.get(CONFIG.SERVER_ID);
    if (guild) {
        await guild.commands.set([
            { name: 'kick', description: 'Kick a user', options: [{ name: 'user', type: 6, description: 'The user to kick', required: true }] },
            { name: 'ban', description: 'Ban a user', options: [{ name: 'user', type: 6, description: 'The user to ban', required: true }] },
            { name: 'warn', description: 'Warn a user', options: [
                { name: 'user', type: 6, description: 'The user to warn', required: true },
                { name: 'reason', type: 3, description: 'Reason', required: true }
            ]},
            { name: 'clear', description: 'Delete messages', options: [{ name: 'amount', type: 4, description: '1-100', required: true }] },
            { name: 'ping', description: 'Bot latency' },
            { name: 'areyouawake', description: 'Check status' }
        ]);
        console.log("Xenon Pro Ready");
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.channel.type === ChannelType.DM) {
        if (CONFIG.MAINTENANCE_MODE) return message.reply("🛠️ Bot is under maintenance.");
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
                addLog("Modmail", `New ticket created for ${message.author.tag}`);
            } finally { activeCreators.delete(message.author.id); }
        }
        if (channel) await channel.send(`**${message.author.username}:** ${message.content}`);
    }

    if (message.content.startsWith('!reply ') && message.channel.parentId === CONFIG.MODMAIL_CATEGORY_ID) {
        const userId = message.channel.topic?.replace('Modmail User ID: ', '');
        const user = await client.users.fetch(userId);
        const reply = message.content.replace('!reply ', '');
        await user.send(`**${CONFIG.ADMIN_NAME}:** ${reply}`);
        addLog("Reply", `Staff replied to ${user.tag}`);
    }

    if (message.content === '!close' && message.channel.parentId === CONFIG.MODMAIL_CATEGORY_ID) {
        addLog("Modmail", `Ticket closed: ${message.channel.name}`);
        await message.channel.send("Closing...");
        setTimeout(() => message.channel.delete(), 2000);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member, user } = interaction;

    if (commandName === 'warn') {
        const target = options.getUser('user');
        const reason = options.getString('reason');
        addLog("Warn", `${user.tag} warned ${target.tag} for: ${reason}`);
        await interaction.reply(`Warned ${target.tag}`);
    }
    
    if (commandName === 'clear') {
        const amount = options.getInteger('amount');
        await interaction.channel.bulkDelete(amount, true);
        addLog("Clear", `${user.tag} cleared ${amount} messages in ${interaction.channel.name}`);
        await interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
    }

    if (commandName === 'kick') {
        const target = options.getMember('user');
        addLog("Kick", `${user.tag} kicked ${target.user.tag}`);
        await target.kick();
        await interaction.reply(`${target.user.tag} kicked.`);
    }

    if (commandName === 'ban') {
        const target = options.getMember('user');
        addLog("Ban", `${user.tag} banned ${target.user.tag}`);
        await target.ban();
        await interaction.reply(`${target.user.tag} banned.`);
    }

    if (commandName === 'ping') await interaction.reply(`Latency: ${client.ws.ping}ms`);
    if (commandName === 'areyouawake') await interaction.reply("I am awake! ☀️");
});

client.login(process.env.TOKEN);
