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

const functions = require("../../utils/functions");
const { Egg } = require("../../database/schemas/egg");
const LATE_CLAIM_WINDOW_MS = 30 * 1000;
const LATE_CLAIM_REACTION = "1498968454458245235";

module.exports = {
	name: "claim",
	category: "general",
	run: async (client, message) => {
		const channel = await client.channels.fetch(process.env.CHANNEL);

		if (message.author.id === client.egg.drop) return;
		if (message.channel.id !== channel.id) return;
		if (!client.egg.id) {
			const lateClaim = client.egg.lateClaim;
			if (!lateClaim) return;
			if (Date.now() > lateClaim.expiresAt) return;
			if (message.author.id === lateClaim.winnerId) return;
			if (lateClaim.reactedUsers.has(message.author.id)) return;

			lateClaim.reactedUsers.add(message.author.id);

			try {
				await message.react(LATE_CLAIM_REACTION);
			} catch (error) {
				lateClaim.reactedUsers.delete(message.author.id);
			}

			return;
		}

		const eggData = await functions.getUserData(Egg(), message.author);
		const point = eggData.get("point");
		const claimedEggs = Math.floor(Math.random() * 10) + 1;

		Egg().update(
			{ point: point + claimedEggs },
			{ where: { userid: message.author.id } }
		);

		const eggMessage =
			(await message.channel.messages.fetch(client.egg.id)) || null;
		if (eggMessage) eggMessage.delete();
		const followupMessage =
			(await message.channel.messages.fetch(client.egg.followupId)) || null;
		if (followupMessage) followupMessage.delete();

		client.egg.id = "";
		client.egg.drop = "";
		client.egg.followupId = "";
		client.egg.lateClaim = {
			winnerId: message.author.id,
			expiresAt: Date.now() + LATE_CLAIM_WINDOW_MS,
			reactedUsers: new Set(),
		};

		message.channel.send({
			content: `${message.member} has claimed the egg! \`+${claimedEggs}\` eggs`,
			allowedMentions: { repliedUser: false, users: [] },
		});
	},
};
