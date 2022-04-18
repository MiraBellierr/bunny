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

module.exports = {
	name: "claim",
	run: async (client, message) => {
		message.delete();

		const channel = await client.channels.fetch(process.env.CHANNEL);

		if (message.channel.id !== channel.id) return;
		if (!client.egg.id) return;

		const eggData = await functions.getUserData(Egg(), message.author);
		const point = eggData.get("point");

		Egg().update(
			{ point: point + 1 },
			{ where: { userid: message.author.id } }
		);

		const eggMessage = await message.channel.messages.fetch(client.egg.id);
		eggMessage.delete();

		client.egg = {};

		message.channel.send(`${message.member.displayName} has claimed the egg!`);
	},
};
