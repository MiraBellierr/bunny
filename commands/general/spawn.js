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

const logger = require("../../utils/logger");
const { rollGoldenEgg, getEggMessage } = require("../../utils/egg");
const { canManageBot } = require("../../utils/auth");
const { pickRandomClaimColor, getClaimPromptText } = require("../../utils/claimPassphrase");

module.exports = {
	name: "spawn",
	run: async (client, message) => {
		if (!canManageBot(message)) return;

		const channel = await client.channels.fetch(process.env.CHANNEL);

		const eggMessage = client.egg.id
			? await message.channel.messages.fetch(client.egg.id).catch(() => null)
			: null;
		if (eggMessage) await eggMessage.delete().catch(() => null);

		const isGolden = rollGoldenEgg();
		const claimColor = pickRandomClaimColor();
		const spawnEgg = await channel.send(getEggMessage(isGolden));
		const msg2 = await channel.send(
			`-# ${getClaimPromptText(process.env.PREFIX, claimColor)} Beep booop!!!`
		);

		if (client.egg.pendingQuizTimer) {
			clearTimeout(client.egg.pendingQuizTimer);
			client.egg.pendingQuizTimer = null;
		}
		client.egg.pendingQuiz = null;
		client.egg.id = spawnEgg.id;
		client.egg.followupId = msg2.id;
		client.egg.isGolden = isGolden;
		client.egg.claimColor = claimColor;
		await client.persistEggRuntimeState?.();
		logger.info(
			`Egg manually spawned | user=${message.author.id} channel=${channel.id} eggMessage=${spawnEgg.id} golden=${isGolden}`
		);

		message.channel.send("Successfully spawned an egg!");
	},
};
