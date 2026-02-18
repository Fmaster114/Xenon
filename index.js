const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, ChannelType } = require('discord.js');
const express = require('express');

// --- 1. CONFIGURATION ---
const SERVER_ID = '1195624668829327450'; 
const MODMAIL_CATEGORY_ID = '1473649458997624843'; 
const STAFF_ROLE_ID = '1473649483836297327';

// Lock to prevent double-channel creation
const activeCreators = new Set();

// --- 2. WEB SERVER ---
const app = express();
app.get('/', (req, res) => res.send('Xenon is Online!'));
app.listen(3000);

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

// --- 4. REGISTER SLASH COMMANDS ---
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    const guild = client.guilds.cache.get(SERVER_ID);
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
        console.log('All commands registered!');
    }
});

// --- 5. MODMAIL LOGIC ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // DM -> Server
    if (message.channel.type === ChannelType.DM) {
        if (activeCreators.has(message.author.id)) return; // Prevent double-trigger

        const guild = client.guilds.cache.get(SERVER_ID);
        const category = guild.channels.cache.get(MODMAIL_CATEGORY_ID);
        
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

    // Server -> DM (Staff Reply)
    if (message.content.startsWith('!reply ') && message.channel.parentId === MODMAIL_CATEGORY_ID) {
        const userId = message.channel.topic?.replace('Modmail User ID: ', '');
        if (!userId) return;

        try {
            const user = await client.users.fetch(userId);
            const reply = message.content.replace('!reply ', '');
            await user.send(`**Administration Team:** ${reply}`); // Updated name
            await message.react('✉️');
        } catch (err) {
            message.reply("Could not DM user.");
        }
    }

    // Close Command
    if (message.content.toLowerCase() === '!close' && message.channel.parentId === MODMAIL_CATEGORY_ID) {
        const userId = message.channel.topic?.replace('Modmail User ID: ', '');
        try {
            const user = await client.users.fetch(userId);
            await user.send("🔒 **Your ticket has been closed by the Administration Team.**");
        } catch (err) { console.log("Could not DM user closing message."); }
        
        await message.channel.send("Closing channel in 5 seconds...");
        setTimeout(() => message.channel.delete(), 5000);
    }
});

// --- 6. SLASH COMMAND HANDLING ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member } = interaction;

    if (commandName === 'ping') {
        await interaction.reply(`🏓 Pong! Latency is ${client.ws.ping}ms.`);
    }

    if (commandName === 'areyouawake') {
        await interaction.reply("Yes, I am awake and active! ☀️");
    }

    if (commandName === 'warn') {
        if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) return interaction.reply("No permission!");
        const target = options.getUser('user');
        const reason = options.getString('reason');
        try {
            await target.send(`⚠️ You have been warned in **${interaction.guild.name}** for: ${reason}`);
            await interaction.reply(`Warned ${target.tag} for: ${reason}`);
        } catch (err) {
            await interaction.reply(`Warned ${target.tag}, but could not DM them.`);
        }
    }

    // Keep Kick/Ban/Clear as they were...
    if (commandName === 'clear') {
        const amount = options.getInteger('amount');
        await interaction.channel.bulkDelete(amount, true);
        await interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
    }
    if (commandName === 'kick') {
        const target = options.getMember('user');
        await target.kick();
        await interaction.reply(`${target.user.tag} kicked.`);
    }
    if (commandName === 'ban') {
        const target = options.getMember('user');
        await target.ban();
        await interaction.reply(`${target.user.tag} banned.`);
    }
});

client.login(process.env.TOKEN);
