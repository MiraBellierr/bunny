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
const { Client, Collection } = require("discord.js");
const fs = require("fs");
const Sequelize = require("sequelize");

new Sequelize("database", "user", "password", {
	host: "localhost",
	dialect: "sqlite",
	logging: false,
	storage: "./database/database.sqlite",
});

const PrivilegedIntents = {
	GUILD_PRESENCES: "GUILD_PRESENCES",
	GUILD_MEMBERS: "GUILD_MEMBERS",
};

const client = new Client({
	allowedMentions: { parse: ["users"] },
	intents: [
		"GUILDS",
		"DIRECT_MESSAGES",
		"DIRECT_MESSAGE_REACTIONS",
		"DIRECT_MESSAGE_TYPING",
		"GUILD_BANS",
		"GUILD_EMOJIS_AND_STICKERS",
		"GUILD_INTEGRATIONS",
		"GUILD_INVITES",
		PrivilegedIntents.GUILD_MEMBERS,
		"GUILD_MESSAGES",
		"GUILD_MESSAGE_REACTIONS",
		"GUILD_MESSAGE_TYPING",
		"GUILD_VOICE_STATES",
		"GUILD_WEBHOOKS",
	],
});

client.commands = new Collection();
client.aliases = new Collection();
client.categories = fs.readdirSync("./commands/");
client.cooldown = null;
client.egg = {};

["command", "event"].forEach((handler) => {
	require(`./handlers/${handler}`)(client);
});

require("./database/schemas/egg").Egg();

client.login(process.env.TOKEN);
