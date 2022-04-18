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

module.exports = async (client, message) => {
	if (!message.guild) return;
	if (message.author.bot) return;

	if (
		!message.guild.me.permissions.has("SEND_MESSAGES") ||
		!message.guild.me.permissionsIn(message.channel).has("SEND_MESSAGES")
	)
		return;

	const prefix = process.env.PREFIX;
	if (message.content.startsWith(prefix)) {
		if (!message.member)
			message.member = await message.guild.fetchMember(message);
		if (
			!message.guild.me.permissions.has("READ_MESSAGE_HISTORY") ||
			!message.guild.me
				.permissionsIn(message.channel)
				.has("READ_MESSAGE_HISTORY")
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
	} else {
		const ms = await import("parse-ms");
		const timer = 60000;

		if (
			client.cooldown === null ||
			timer - (Date.now() - client.cooldown) < 1
		) {
			client.cooldown = Date.now();

			const channel = await client.channels.fetch(process.env.CHANNEL);

			if (Math.floor(Math.random() * 100) <= 30) {
				const message = await channel.send("🥚");

				client.egg = {
					id: message.id,
				};
			}
		}
	}
};
