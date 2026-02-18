const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, ChannelType } = require('discord.js');
const express = require('express');

// --- CONFIGURATION (IMPORTANT) ---
const SERVER_ID = '1195624668829327450'; 
const MODMAIL_CATEGORY_ID = '1473649458997624843'; // Where modmail channels will appear
const STAFF_ROLE_ID = '1473649483836297327';     // Role that can see/reply to modmail

// 1. KEEP-ALIVE SERVER
const app = express();
app.get('/', (req, res) => res.send('Bot is awake!'));
app.listen(3000);

// 2. BOT SETUP (Added DirectMessages partial for Modmail)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});

// 3. REGISTER COMMANDS
client.once('ready', async () => {
    const commandsData = [
        { name: 'kick', description: 'Kick a user', options: [{ name: 'target', type: 6, description: 'The user to kick', required: true }] },
        { name: 'ban', description: 'Ban a user', options: [{ name: 'target', type: 6, description: 'The user to ban', required: true }] },
        { name: 'clear', description: 'Delete messages', options: [{ name: 'amount', type: 4, description: 'Number of messages', required: true }] }
    ];
    const guild = client.guilds.cache.get(SERVER_ID);
    if (guild) await guild.commands.set(commandsData);
    console.log('Mod commands ready!');
});

// 4. HANDLE MODERATION & MODMAIL
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // --- MODMAIL LOGIC (DM -> Server) ---
    if (message.channel.type === ChannelType.DM) {
        const guild = client.guilds.cache.get(SERVER_ID);
        const category = guild.channels.cache.get(MODMAIL_CATEGORY_ID);
        
        // Find or create a channel for this user
        let channel = guild.channels.cache.find(c => c.name === `mail-${message.author.id}`);
        if (!channel) {
            channel = await guild.channels.create({
                name: `mail-${message.author.id}`,
                type: ChannelType.GuildText,
                parent: category,
                topic: `Modmail from ${message.author.tag} (${message.author.id})`
            });
            await channel.send(`📬 **New Modmail from ${message.author.tag}**\nUse \`!reply <message>\` to respond.`);
        }
        await channel.send(`**${message.author.username}:** ${message.content}`);
        await message.react('✅');
    }

    // --- MODMAIL REPLY LOGIC (Server -> DM) ---
    if (message.content.startsWith('!reply ') && message.channel.name.startsWith('mail-')) {
        const userId = message.channel.name.split('-')[1];
        const user = await client.users.fetch(userId);
        const replyText = message.content.replace('!reply ', '');
        
        await user.send(`**Staff:** ${replyText}`).catch(() => message.reply("Could not DM user."));
        await message.react('✉️');
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member } = interaction;

    // KICK COMMAND
    if (commandName === 'kick') {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply("No permission!");
        const target = options.getMember('target');
        await target.kick();
        await interaction.reply(`${target.user.tag} was kicked.`);
    }

    // CLEAR COMMAND
    if (commandName === 'clear') {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply("No permission!");
        const amount = options.getInteger('amount');
        await interaction.channel.bulkDelete(amount, true);
        await interaction.reply({ content: `Deleted ${amount} messages.`, ephemeral: true });
    }
});

client.login(process.env.TOKEN);
