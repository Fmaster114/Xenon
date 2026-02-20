const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, ChannelType, ActivityType } = require('discord.js');
const express = require('express');

// --- 1. CONFIGURATION ---
const CONFIG = {
    SERVER_ID: '1195624668829327450',
    MODMAIL_CATEGORY_ID: '1473649458997624843',
    STAFF_ROLE_ID: '1473649483836297327',
    DASHBOARD_PASSWORD: 'YourSecretPassword123', // <--- CHANGE THIS FOR SECURITY!
    MAINTENANCE_MODE: false
};

const activeCreators = new Set();

// --- 2. THE DASHBOARD SERVER ---
const app = express();
app.use(express.urlencoded({ extended: true }));

// Visual Dashboard Page
app.get('/dashboard', (req, res) => {
    res.send(`
        <html>
            <head>
                <title>Xenon Control Panel</title>
                <meta name="viewport" content="width=device-width, initial-scale=1">
            </head>
            <body style="font-family: 'Segoe UI', sans-serif; text-align: center; background: #2c2f33; color: white; padding: 50px 20px;">
                <h1 style="color: #7289da;">Xenon Bot Dashboard</h1>
                <div style="background: #23272a; display: inline-block; padding: 30px; border-radius: 15px; border: 2px solid ${CONFIG.MAINTENANCE_MODE ? '#f04747' : '#43b581'}; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    <p style="font-size: 1.2em;">System Status: 
                        <span style="color: ${CONFIG.MAINTENANCE_MODE ? '#f04747' : '#43b581'}; font-weight: bold;">
                            ${CONFIG.MAINTENANCE_MODE ? "🛠️ MAINTENANCE MODE" : "✅ ONLINE"}
                        </span>
                    </p>
                    <hr style="border: 0; border-top: 1px solid #444; margin: 20px 0;">
                    <form action="/toggle" method="POST">
                        <input type="password" name="password" placeholder="Dashboard Password" style="padding: 10px; border-radius: 5px; border: none; margin-bottom: 15px; width: 80%;" required><br>
                        <button type="submit" style="background: #7289da; color: white; border: none; padding: 12px 25px; border-radius: 5px; font-weight: bold; cursor: pointer; transition: 0.3s;">
                            Switch to ${CONFIG.MAINTENANCE_MODE ? 'Online Mode' : 'Maintenance Mode'}
                        </button>
                    </form>
                </div>
                <p style="margin-top: 20px; color: #99aab5; font-size: 0.8em;">Logged in as: Xenon#5613</p>
            </body>
        </html>
    `);
});

// Logic for the Toggle Button
app.post('/toggle', (req, res) => {
    if (req.body.password !== CONFIG.DASHBOARD_PASSWORD) {
        return res.send("<h1>❌ Access Denied: Incorrect Password</h1><a href='/dashboard'>Go Back</a>");
    }
    CONFIG.MAINTENANCE_MODE = !CONFIG.MAINTENANCE_MODE;
    updateBotStatus(); 
    res.redirect('/dashboard');
});

app.get('/', (req, res) => res.send('Xenon Web Server is Live! Use /dashboard to manage.'));
app.listen(3000, () => console.log("Dashboard available at /dashboard"));

// --- 3. BOT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// Status Manager
function updateBotStatus() {
    if (CONFIG.MAINTENANCE_MODE) {
        client.user.setActivity('🛠️ Maintenance', { type: ActivityType.Custom });
        client.user.setStatus('dnd');
    } else {
        client.user.setActivity('Watching DMs', { type: ActivityType.Watching });
        client.user.setStatus('online');
    }
}

// --- 4. READY EVENT ---
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    updateBotStatus();

    const guild = client.guilds.cache.get(CONFIG.SERVER_ID);
    if (guild) {
        await guild.commands.set([
            { name: 'kick', description: 'Kick a user', options: [{ name: 'user', type: 6, description: 'The user to kick', required: true }] },
            { name: 'ban', description: 'Ban a user', options: [{ name: 'user', type: 6, description: 'The user to ban', required: true }] },
            { name: 'warn', description: 'Warn a user', options: [
                { name: 'user', type: 6, description: 'The user to warn', required: true },
                { name: 'reason', type: 3, description: 'Why are you warning them?', required: true }
            ]},
            { name: 'clear', description: 'Delete messages', options: [{ name: 'amount', type: 4, description: '1-100', required: true }] },
            { name: 'ping', description: 'Check bot latency' },
            { name: 'areyouawake', description: 'Check if the bot is active' }
        ]);
        console.log('Commands synced with Discord.');
    }
});

// --- 5. MODMAIL LOGIC ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Maintenance Block for DMs
    if (CONFIG.MAINTENANCE_MODE && message.channel.type === ChannelType.DM) {
        return message.reply("🛠️ **Maintenance Mode:** Our staff team is currently updating the bot. Modmail is temporarily disabled.");
    }

    // DM -> Server
    if (message.channel.type === ChannelType.DM) {
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
                await channel.send(`📬 **New Ticket: ${message.author.tag}**\nUse \`!reply <msg>\` to talk or \`!close\` to end.`);
            } finally {
                activeCreators.delete(message.author.id);
            }
        }
        
        if (channel) {
            await channel.send(`**${message.author.username}:** ${message.content}`);
            await message.react('✅');
        }
    }

    // Staff !reply
    if (message.content.startsWith('!reply ') && message.channel.parentId === CONFIG.MODMAIL_CATEGORY_ID) {
        const userId = message.channel.topic?.replace('Modmail User ID: ', '');
        if (!userId) return;

        try {
            const user = await client.users.fetch(userId);
            const reply = message.content.replace('!reply ', '');
            await user.send(`**Administration Team:** ${reply}`);
            await message.react('✉️');
        } catch (err) {
            message.reply("Could not DM user.");
        }
    }

    // !close Command
    if (message.content.toLowerCase() === '!close' && message.channel.parentId === CONFIG.MODMAIL_CATEGORY_ID) {
        const userId = message.channel.topic?.replace('Modmail User ID: ', '');
        try {
            const user = await client.users.fetch(userId);
            await user.send("🔒 **Your ticket has been closed by the Administration Team.**");
        } catch (err) { console.log("User has DMs closed."); }
        
        await message.channel.send("Channel will delete in 5 seconds...");
        setTimeout(() => message.channel.delete(), 5000);
    }
});

// --- 6. SLASH COMMAND HANDLING ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    // Maintenance Block for Commands
    if (CONFIG.MAINTENANCE_MODE && !['ping', 'areyouawake'].includes(interaction.commandName)) {
        return interaction.reply({ content: "🛠️ This command is disabled during maintenance.", ephemeral: true });
    }

    const { commandName, options, member } = interaction;

    if (commandName === 'ping') {
        await interaction.reply(`🏓 Latency: ${client.ws.ping}ms.`);
    }

    if (commandName === 'areyouawake') {
        await interaction.reply(CONFIG.MAINTENANCE_MODE ? "I'm awake, but under maintenance! 🛠️" : "Yes, I'm active! ☀️");
    }

    if (commandName === 'warn') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return interaction.reply("No permission.");
        const target = options.getUser('user');
        const reason = options.getString('reason');
        try {
            await target.send(`⚠️ Warning from **${interaction.guild.name}**: ${reason}`);
            await interaction.reply(`Warned ${target.tag} for: ${reason}`);
        } catch (err) {
            await interaction.reply(`Warned ${target.tag}, but their DMs are off.`);
        }
    }

    if (commandName === 'clear') {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply("No permission.");
        const amount = options.getInteger('amount');
        await interaction.channel.bulkDelete(amount, true);
        await interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
    }

    if (commandName === 'kick') {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply("No permission.");
        const target = options.getMember('user');
        await target.kick();
        await interaction.reply(`${target.user.tag} has been kicked.`);
    }

    if (commandName === 'ban') {
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply("No permission.");
        const target = options.getMember('user');
        await target.ban();
        await interaction.reply(`${target.user.tag} has been banned.`);
    }
});

client.login(process.env.TOKEN);
