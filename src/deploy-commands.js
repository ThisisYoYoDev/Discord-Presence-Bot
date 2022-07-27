
const { SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { clientId, guildId, token } = require('../config/config.json');

const commands = [
	new SlashCommandBuilder()
		.setName('presence')
		.setDescription('Get Presence of a channel during an activity')
		.addChannelOption(option =>
			option.setName('destination')
				.setDescription('Select a channel')
				.addChannelTypes(2)
				.addChannelTypes(13)
				.setRequired(true)
		)
]
	.map(command => command.toJSON());


const rest = new REST({ version: '10' }).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
	.then(() => console.log('Successfully registered application commands.'))
	.catch(console.error);
