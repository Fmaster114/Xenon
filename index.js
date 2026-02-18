const { Client, GatewayIntentBits, Partials, PermissionFlagsBits, ChannelType } = require('discord.js');
const express = require('express');

// --- 1. CONFIGURATION (Your IDs Applied) ---
const SERVER_ID = '1195624668829327450'; 
const MODMAIL_CATEGORY_ID = '1473649458997624843'; 
const STAFF_ROLE_ID = '1473649483836297327';

// --- 2. WEB SERVER (KEEP-ALIVE) ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Online and Ready!'));
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
            { name: 'clear', description: 'Delete messages', options: [{ name: 'amount', type: 4, description: '1-100', required: true }] }
        ]);
        console.log('Moderation commands registered!');
    }
});

// --- 5. MODMAIL LOGIC ---
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Handle DM -> Server (User sending a ticket)
    if (message.channel.type === ChannelType.DM) {
        const guild = client.guilds.cache.get(SERVER_ID);
        const category = guild.channels.cache.get(MODMAIL_CATEGORY_ID);
        
        if (!guild || !category) return console.log("Error: Could not find Server or Category ID.");

        let channel = guild.channels.cache.find(c => c.topic === `Modmail User ID: ${message.author.id}`);
        
        if (!channel) {
            channel = await guild.channels.create({
                name: `mail-${message.author.username}`,
                type: ChannelType.GuildText,
                parent: category,
                topic: `Modmail User ID: ${message.author.id}`
            });
            await channel.send(`📬 **New Ticket: ${message.author.tag}**\nUse \`!reply <message>\` to respond to the user.`);
        }
        await channel.send(`**${message.author.username}:** ${message.content}`);
        await message.react('✅');
    }

    // Handle Server -> DM (Staff replying to user)
    // This checks if the message is in a channel inside your Modmail Category
    if (message.content.startsWith('!reply ') && message.channel.parentId === MODMAIL_CATEGORY_ID) {
        if (!message.member.roles.cache.has(STAFF_ROLE_ID)) return message.reply("Only staff can reply!");

        const userId = message.channel.topic?.replace('Modmail User ID: ', '');
        if (!userId) return;

        try {
            const user = await client.users.fetch(userId);
            const reply = message.content.replace('!reply ', '');
            await user.send(`**Staff Support:** ${reply}`);
            await message.react('✉️');
        } catch (err) {
            message.reply("Could not DM the user. They may have DMs closed.");
        }
    }
});

// --- 6. MODERATION COMMANDS HANDLING ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member } = interaction;

    if (commandName === 'clear') {
        if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) return interaction.reply({ content: 'No permission!', ephemeral: true });
        const amount = options.getInteger('amount');
        await interaction.channel.bulkDelete(amount, true);
        await interaction.reply({ content: `Cleared ${amount} messages.`, ephemeral: true });
    }

    if (commandName === 'kick') {
        if (!member.permissions.has(PermissionFlagsBits.KickMembers)) return interaction.reply('No permission!');
        const target = options.getMember('user');
        await target.kick();
        await interaction.reply(`${target.user.tag} has been kicked.`);
    }

    if (commandName === 'ban') {
        if (!member.permissions.has(PermissionFlagsBits.BanMembers)) return interaction.reply('No permission!');
        const target = options.getMember('user');
        await target.ban();
        await interaction.reply(`${target.user.tag} has been banned.`);
    }
});

client.login(process.env.TOKEN);
