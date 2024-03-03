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

module.exports = {
	name: "spawn",
	run: async (client, message) => {
		if (message.author.id !== "548050617889980426") return;

		const channel = await client.channels.fetch(process.env.CHANNEL);

		if (message.channel.id !== channel.id) return;

		const eggMessage =
			(await message.channel.messages.fetch(client.egg.id)) || null;
		eggMessage.delete();

		const spawnEgg = await channel.send("🥚");

		client.egg = {
			id: spawnEgg.id,
		};

		message.channel.send("Successfully spawned an egg!");
	},
};
