/**
 *    Copyright 2022 MiraBellier

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

require("dotenv").config();
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
require("./database/sequelize");

const requiredEnvVars = ["TOKEN", "PREFIX", "CHANNEL"];
const missingEnvVars = requiredEnvVars.filter(
	(name) => !process.env[name] || !process.env[name].trim()
);

if (missingEnvVars.length) {
	console.error(
		`[BOOT ERROR] Missing required environment variable(s): ${missingEnvVars.join(
			", "
		)}.\nPlease set TOKEN, PREFIX, and CHANNEL in your .env file.`
	);
	process.exit(1);
}

const client = new Client({
	allowedMentions: { parse: ["users"] },
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildBans,
		GatewayIntentBits.GuildEmojisAndStickers,
		GatewayIntentBits.GuildIntegrations,
		GatewayIntentBits.GuildInvites,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildVoiceStates,
	],
});

client.commands = new Collection();
client.aliases = new Collection();
client.categories = fs.readdirSync("./commands/");
client.cooldown = null;
client.egg = {
	id: "",
	followupId: "",
	rate: process.env.rate || 3,
	drop: "",
	isGolden: false,
	activityTimestamps: [],
	claimStreak: {
		userId: "",
		count: 0,
	},
};

["command", "event"].forEach((handler) => {
	require(`./handlers/${handler}`)(client);
});

require("./database/schemas/egg").Egg();

client.login(process.env.TOKEN);
