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
const { resolveClaimColor } = require("../../utils/claimPassphrase");
const {
	calculateClaimRewardContext,
	clearActiveEggState,
	cleanupEggMessages,
	resolvePendingQuizAsIncorrect,
} = require("../../utils/claimQuiz");

const CLAIM_LOCK_MS = 10 * 1000;

module.exports = {
	name: "claim",
	category: "general",
	run: async (client, message, args = []) => {
		const channel = await client.channels.fetch(process.env.CHANNEL);

		if (message.author.id === client.egg.drop) return;
		if (message.channel.id !== channel.id) return;
		if (!client.egg.id) return;
		if (client.egg.pendingQuiz && Date.now() > client.egg.pendingQuiz.expiresAt) {
			await resolvePendingQuizAsIncorrect(client, "timeout");
		}
		if (client.egg.pendingQuiz && Date.now() <= client.egg.pendingQuiz.expiresAt) {
			return;
		}
		if (!client.egg.id) return;

		const activeLock = client.egg.claimLock;
		if (activeLock && activeLock.eggId === client.egg.id && Date.now() < activeLock.expiresAt)
			return;

		const expectedClaimColor = resolveClaimColor(client.egg.claimColor);
		if (!expectedClaimColor) return;

		const providedClaimColor = resolveClaimColor(args.join(" "));
		if (!providedClaimColor || providedClaimColor !== expectedClaimColor) return;

		const lockToken = `${message.id}:${Date.now()}`;
		const claimedEggId = client.egg.id;
		const claimedFollowupId = client.egg.followupId;
		const claimedIsDroppedEgg = Boolean(client.egg.drop);
		const claimedIsGolden = !claimedIsDroppedEgg && Boolean(client.egg.isGolden);
		let shouldReleaseLock = true;

		client.egg.claimLock = {
			token: lockToken,
			eggId: claimedEggId,
			expiresAt: Date.now() + CLAIM_LOCK_MS,
		};

		try {
			await functions.getUserData(Egg, message.author);
			const rewardContext = calculateClaimRewardContext({
				client,
				userId: message.author.id,
				claimedIsDroppedEgg,
				claimedIsGolden,
			});
			await Egg.increment(
				{ point: rewardContext.totalClaimedEggs },
				{ where: { userid: message.author.id } }
			);
			if (rewardContext.shouldTrackStreak) {
				client.egg.claimStreak = {
					userId: message.author.id,
					count: rewardContext.nextStreakCount,
				};
			}

			await clearActiveEggState(client, claimedEggId);
			await cleanupEggMessages(message.channel, claimedEggId, claimedFollowupId);

			await message.channel.send({
				content: claimedIsGolden
					? `${message.member} has claimed a GOLDEN egg! ✨ \`+${rewardContext.totalClaimedEggs}\` eggs`
					: `${message.member} has claimed the egg! \`+${rewardContext.totalClaimedEggs}\` eggs`,
				allowedMentions: { repliedUser: false, users: [] },
			});

			if (rewardContext.streakBonus > 0) {
				await message.channel.send(
					`Streak bonus: \`+${rewardContext.streakBonus}\` (streak ${rewardContext.nextStreakCount})`
				);
			}

			logger.info(
				`Egg claimed | user=${message.author.id} reward=${rewardContext.totalClaimedEggs} baseReward=${rewardContext.claimedEggs} streakBonus=${rewardContext.streakBonus} streakCount=${rewardContext.nextStreakCount} eggMessage=${claimedEggId} golden=${claimedIsGolden} dropped=${claimedIsDroppedEgg}`
			);
		} finally {
			if (
				shouldReleaseLock &&
				client.egg.claimLock &&
				client.egg.claimLock.token === lockToken
			) {
				client.egg.claimLock = null;
			}
		}
	},
};
