const fs = require("fs");
const moment = require('moment-timezone');
const { v4: uuidv4 } = require('uuid');
const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { token, AdminRole } = require('../config/config.json');
const presenceCalculator = require('./presenceCalculator.js');
fs.readFileSync("./config/db.json", "utf-8");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.GuildVoiceStates]
});

client.once('ready', () => {
    console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    // get the user who sent the command
    if (!interaction.member.roles.cache.has(AdminRole)) {
        await interaction.reply("You do not have permission to use this command.");
        return;
    }

    const { commandName } = interaction;

    if (commandName === 'presence') {
        const stopButton = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('stop')
                    .setLabel('Stop Analysis')
                    .setStyle(ButtonStyle.Danger)
            );
        // create a button to stop the analysis
        const started = moment.tz('Europe/Madrid').format('YYYY-MM-DD HH:mm:ss')
        const destinationChannel = interaction.options.getChannel('destination');
        await interaction.reply({ content: 'Analysis in progress on channel ' + destinationChannel.name + ' at ' + started, components: [stopButton] });

        const members = await destinationChannel.members;
        members.forEach(member => {
            fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'joined', user: member.user.username + '#' + member.user.discriminator, channel: destinationChannel.id, time: new Date(started).getTime() / 1000 }) + "\n");
        });
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'StartedTimeRequest', channel: destinationChannel.id, time: new Date(started).getTime() / 1000 }) + "\n");
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    if (!interaction.id === 'stop') return;

    const end = moment.tz('Europe/Madrid').format('YYYY-MM-DD HH:mm:ss')
    // get started time from db read from file and delete it
    let lines = fs.readFileSync("./config/db.json", "utf-8").split("\n");
    let startedTime = 0;
    let channelId = 0;
    let index = 0;
    for (let i = 0; i < lines.length - 1; i++) {
        let line = JSON.parse(lines[i]);
        if (line.type == 'StartedTimeRequest') {
            startedTime = line.time;
            channelId = line.channel;
            index = i;
            break;
        }
    }
    lines.splice(index, 1);
    fs.writeFileSync("./config/db.json", lines.join("\n"));


    // get channel from id
    const channel = client.channels.cache.get(channelId);
    const members = await channel.members;
    members.forEach(member => {
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'leave', user: member.user.username + '#' + member.user.discriminator, channel: channelId, time: new Date(end).getTime() / 1000 }) + "\n");
    });

    const timeSpendperUser = presenceCalculator(startedTime, new Date(end).getTime() / 1000, channelId);
    // create a csv file with the results
    const csv = timeSpendperUser.map(user => "name, " + user.user + ", timeSpendinSecond, " + user.time).join("\n");
    // create name with uuid
    const name = './log/presence_' + uuidv4() + '.csv';
    fs.writeFileSync(name, csv);
    interaction.reply({ content: 'Analysis finished', files: [name] });
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    let newUserChannel = newState.channel;
    let oldUserChannel = oldState.channel;

    if (oldUserChannel === null && newUserChannel !== null) {
        // User Join a voice channel
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'joined', user: newState.member.user.username + "#" + newState.member.user.discriminator, channel: newUserChannel.id, time: new Date(moment.tz('Europe/Madrid').format('YYYY-MM-DD HH:mm:ss')).getTime() / 1000 }) + "\n");
    } else if (oldUserChannel !== null && newUserChannel === null) {
        // User Leave a voice channel
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'leave', user: newState.member.user.username + "#" + newState.member.user.discriminator, channel: oldUserChannel.id, time: new Date(moment.tz('Europe/Madrid').format('YYYY-MM-DD HH:mm:ss')).getTime() / 1000 }) + "\n");
    } else if (oldUserChannel !== null && newUserChannel !== null && oldUserChannel.id != newUserChannel.id) {
        // User Switch a voice channel
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'switch', user: newState.member.user.username + "#" + newState.member.user.discriminator, from: oldUserChannel.id, to: newUserChannel.id, time: new Date(moment.tz('Europe/Madrid').format('YYYY-MM-DD HH:mm:ss')).getTime() / 1000 }) + "\n");
    }
});

// Login to Discord with your client's token
client.login(token);

module.exports = client;