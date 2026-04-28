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

const { PermissionsBitField } = require("discord.js");
let before = "";

module.exports = async (client, message) => {
	if (!message.guild) return;
	if (message.author.bot) return;

	if (
		!message.guild.members.me.permissions.has(
			PermissionsBitField.Flags.SendMessages
		) ||
		!message.guild.members.me
			.permissionsIn(message.channel)
			.has(PermissionsBitField.Flags.SendMessages)
	)
		return;

	const prefix = process.env.PREFIX;

	if (message.content.startsWith(prefix)) {
		if (!message.member)
			message.member = await message.guild.fetchMember(message);
		if (
			!message.guild.members.me.permissions.has(
				PermissionsBitField.Flags.ReadMessageHistory
			) ||
			!message.guild.members.me
				.permissionsIn(message.channel)
				.has(PermissionsBitField.Flags.ReadMessageHistory)
		)
			return message.channel.send(
				"I need a read message history permission for me to be able to reply to the past messages."
			);

		const args = message.content.slice(prefix.length).trim().split(/ +/g);
		const cmd = args.shift().toLowerCase();

		if (cmd.length === 0) return;

		let command = client.commands.get(cmd);
		if (!command) command = client.commands.get(client.aliases.get(cmd));

		try {
			if (command) {
				command.run(client, message, args);
			}
		} catch (error) {
			console.error(error);
			message.reply(
				`there was an error trying to execute that command! \n\`${error}\``
			);
		}
	}

	const timer = 1000 * 60 * 10;

	if (message.channel.id === process.env.CHANNEL) {
		if (
			client.cooldown === null ||
			timer - (Date.now() - client.cooldown) < 1
		) {
			const channel = await client.channels.fetch(process.env.CHANNEL);
			const random = Math.floor(Math.random() * 100);
			console.log(`Random: ${random}\nRate: ${client.egg.rate}`);

			if (before !== message.author.id && random <= client.egg.rate) {
				before = message.author.id;
				const previousEgg =
					(await message.channel.messages.fetch(client.egg.id)) || null;

				if (previousEgg) previousEgg.delete();

				const msg = await channel.send("<:DColon:881068692174159882>");
				const msg2 = await channel.send(`-# type \`${process.env.PREFIX}claim\` to claim it! Person who gets the most <:DColon:881068692174159882> will get a mystery gift!`);

				client.cooldown = Date.now();
				client.egg.drop = "";
				client.egg.followupId = msg2.id;
				client.egg.id = msg.id;
			}
		}
	}
};
