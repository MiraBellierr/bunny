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
const logger = require("../../utils/logger");
const { rollClaimedEggs } = require("../../utils/egg");
const CLAIM_LOCK_MS = 10 * 1000;
const DEFAULT_STREAK_TIER_SIZE = 5;

const getClaimStreakTierSize = () => {
	const parsedTierSize = Number.parseInt(process.env.CLAIM_STREAK_TIER_SIZE || "", 10);
	if (Number.isNaN(parsedTierSize) || parsedTierSize < 1) {
		return DEFAULT_STREAK_TIER_SIZE;
	}

	return parsedTierSize;
};

module.exports = {
	name: "claim",
	category: "general",
	run: async (client, message) => {
		const channel = await client.channels.fetch(process.env.CHANNEL);

		if (message.author.id === client.egg.drop) return;
		if (message.channel.id !== channel.id) return;
		if (!client.egg.id) return;

		const activeLock = client.egg.claimLock;
		if (activeLock && activeLock.eggId === client.egg.id && Date.now() < activeLock.expiresAt)
			return;

		const lockToken = `${message.id}:${Date.now()}`;
		const claimedEggId = client.egg.id;
		const claimedFollowupId = client.egg.followupId;
		const claimedIsDroppedEgg = Boolean(client.egg.drop);
		const claimedIsGolden = !claimedIsDroppedEgg && Boolean(client.egg.isGolden);
		client.egg.claimLock = {
			token: lockToken,
			eggId: claimedEggId,
			expiresAt: Date.now() + CLAIM_LOCK_MS,
		};

		try {
			await functions.getUserData(Egg(), message.author);
			const currentStreak = client.egg.claimStreak || { userId: "", count: 0 };
			const shouldTrackStreak = !claimedIsDroppedEgg;
			const nextStreakCount = shouldTrackStreak
				? currentStreak.userId === message.author.id
					? currentStreak.count + 1
					: 1
				: currentStreak.count;
			const streakTierSize = getClaimStreakTierSize();
			const streakBonus = shouldTrackStreak
				? Math.floor(nextStreakCount / streakTierSize)
				: 0;
			const claimedEggs = claimedIsDroppedEgg ? 1 : rollClaimedEggs(claimedIsGolden);
			const totalClaimedEggs = claimedEggs + streakBonus;

			await Egg().increment(
				{ point: totalClaimedEggs },
				{ where: { userid: message.author.id } }
			);
			if (shouldTrackStreak) {
				client.egg.claimStreak = {
					userId: message.author.id,
					count: nextStreakCount,
				};
			}

			if (client.egg.id === claimedEggId) {
				client.egg.id = "";
				client.egg.drop = "";
				client.egg.followupId = "";
				client.egg.isGolden = false;
			}

			const eggMessage = await message.channel.messages.fetch(claimedEggId).catch(() => null);
			if (eggMessage) await eggMessage.delete().catch(() => null);

			const followupMessage = await message.channel.messages
				.fetch(claimedFollowupId)
				.catch(() => null);
			if (followupMessage) await followupMessage.delete().catch(() => null);

			await message.channel.send({
				content: claimedIsGolden
					? `${message.member} has claimed a GOLDEN egg! ✨ \`+${totalClaimedEggs}\` eggs`
					: `${message.member} has claimed the egg! \`+${totalClaimedEggs}\` eggs`,
				allowedMentions: { repliedUser: false, users: [] },
			});

			if (streakBonus > 0) {
				await message.channel.send(
					`Streak bonus: \`+${streakBonus}\` (streak ${nextStreakCount})`
				);
			}

			logger.info(
				`Egg claimed | user=${message.author.id} reward=${totalClaimedEggs} baseReward=${claimedEggs} streakBonus=${streakBonus} streakCount=${nextStreakCount} eggMessage=${claimedEggId} golden=${claimedIsGolden} dropped=${claimedIsDroppedEgg}`
			);
		} finally {
			if (client.egg.claimLock && client.egg.claimLock.token === lockToken) {
				client.egg.claimLock = null;
			}
		}
	},
};
