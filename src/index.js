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

        if (fs.existsSync("./config/db.json")) {
            const db = fs.readFileSync("./config/db.json", "utf-8").split("\n");
            for (let i = 0; i < db.length - 1; i++) {
                let line = JSON.parse(db[i]);
                if (line.type === 'StartedTimeRequest') {
                    await interaction.reply("There is already a started time request. Please wait for it to finish.");
                    return;
                }
            }
        }

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
        const roleId = interaction.options.getRole('role');
        await interaction.reply({ content: 'Analysis in progress on channel ' + destinationChannel.name + ' at ' + started, components: [stopButton] });

        const members = await destinationChannel.members;
        members.forEach(member => {
            fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'joined', user: member.user.username + '#' + member.user.discriminator, nickname: member.displayName, channel: destinationChannel.id, time: new Date(started).getTime() / 1000 }) + "\n");
        });
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'StartedTimeRequest', role: roleId.id, channel: destinationChannel.id, time: started }) + "\n");
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
    let checkStart = false;
    let role = 0;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i] === "") continue;
        let line = JSON.parse(lines[i]);
        if (line.type == 'StartedTimeRequest') {
            startedTime = line.time;
            channelId = line.channel;
            index = i;
            checkStart = true;
            role = line.role;
            break;
        }
    }

    if (!checkStart) {
        await interaction.update({ content: "There is no started time request.", files: [], components: [] });
        return;
    }

    lines.splice(index, 1);
    fs.writeFileSync("./config/db.json", lines.join("\n"));

    // get channel from id
    const membersRoles = interaction.guild.roles.cache.get(role).members.map(member => member.user.username + '#' + member.user.discriminator);
    const getTimeOfRequestInSecond = (new Date(end).getTime() / 1000) - (new Date(startedTime).getTime() / 1000);
    const channel = client.channels.cache.get(channelId);
    const members = await channel.members;
    members.forEach(member => {
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'leave', user: member.user.username + '#' + member.user.discriminator, nickname: member.displayName, channel: channelId, time: new Date(end).getTime() / 1000 }) + "\n");
    });

    const timeSpendperUser = presenceCalculator((new Date(startedTime).getTime() / 1000), new Date(end).getTime() / 1000, channelId);
    const csv = timeSpendperUser.map(user => {
        if (!(user.time / getTimeOfRequestInSecond > 0.25)) {
            return "name" + ": " + user.user + "; " + "nickname" + ": " + user.nickname + "; " + "timeSpendInSecond" + ": " + user.time + "; " + "status: absent";
        } else {
            return "name" + ": " + user.user + "; " + "nickname" + ": " + user.nickname + "; " + "timeSpendInSecond" + ": " + user.time + "; " + "status: present";
        }
    }).join('\n');

    const notInTimeSpendperUser = membersRoles.filter(user => !timeSpendperUser.some(user2 => user2.user === user));
    const csv2 = notInTimeSpendperUser.map(user => {
        const userId = client.users.cache.find(user2 => user2.username === user.split('#')[0] && user2.discriminator === user.split('#')[1]).id;
        const displayName = interaction.guild.members.cache.find(member => member.id === userId).displayName;
        return "name" + ": " + user + "; " + "nickname" + ": " + displayName + "; " + "status: absent";
    }).join('\n');

    // create name with uuid
    const name = './log/presence_' + uuidv4() + '.csv';
    fs.writeFileSync(name, csv + '\n' + csv2);
    interaction.update({ content: 'Analysis Finished (' + channel.name + '):\nStarting Time at ' + startedTime + ' \nEnd Time at ' + end + '\n' + 'Time of request in seconds: ' + getTimeOfRequestInSecond + 's' + " (" + (getTimeOfRequestInSecond / 60).toPrecision(1) + "minutes)", files: [name], components: [] });
});

client.on('voiceStateUpdate', async (oldState, newState) => {
    let newUserChannel = newState.channel;
    let oldUserChannel = oldState.channel;

    if (oldUserChannel === null && newUserChannel !== null) {
        // User Join a voice channel
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'joined', user: newState.member.user.username + "#" + newState.member.user.discriminator, nickname: newState.member.displayName, channel: newUserChannel.id, time: new Date(moment.tz('Europe/Madrid').format('YYYY-MM-DD HH:mm:ss')).getTime() / 1000 }) + "\n");
    } else if (oldUserChannel !== null && newUserChannel === null) {
        // User Leave a voice channel
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'leave', user: newState.member.user.username + "#" + newState.member.user.discriminator, nickname: newState.member.displayName, channel: oldUserChannel.id, time: new Date(moment.tz('Europe/Madrid').format('YYYY-MM-DD HH:mm:ss')).getTime() / 1000 }) + "\n");
    } else if (oldUserChannel !== null && newUserChannel !== null && oldUserChannel.id != newUserChannel.id) {
        // User Switch a voice channel
        fs.appendFileSync("./config/db.json", JSON.stringify({ type: 'switch', user: newState.member.user.username + "#" + newState.member.user.discriminator, nickname: newState.member.displayName, from: oldUserChannel.id, to: newUserChannel.id, time: new Date(moment.tz('Europe/Madrid').format('YYYY-MM-DD HH:mm:ss')).getTime() / 1000 }) + "\n");
    }
});

// Login to Discord with your client's token
client.login(token);

module.exports = client;
