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
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const {
	TOP_QUIZ_RANK_LIMIT,
	CLAIM_QUIZ_TIMEOUT_MS,
	QUIZ_BUTTON_LABELS,
	calculateClaimRewardContext,
	isUserInTopRanks,
	pickRandomQuizQuestion,
	formatQuizPrompt,
	createQuizToken,
	buildQuizButtonCustomId,
	clearPendingQuizTimer,
	clearActiveEggState,
	cleanupEggMessages,
	resolvePendingQuizAsIncorrect,
} = require("../../utils/claimQuiz");

const CLAIM_LOCK_MS = 10 * 1000;

module.exports = {
	name: "claim",
	category: "general",
	run: async (client, message) => {
		const channel = await client.channels.fetch(process.env.CHANNEL);

		if (message.author.id === client.egg.drop) return;
		if (message.channel.id !== channel.id) return;
		if (!client.egg.id) return;
		if (client.egg.pendingQuiz && Date.now() > client.egg.pendingQuiz.expiresAt) {
			await resolvePendingQuizAsIncorrect(client, "timeout");
		}
		if (!client.egg.id) return;

		const activeLock = client.egg.claimLock;
		if (activeLock && activeLock.eggId === client.egg.id && Date.now() < activeLock.expiresAt)
			return;

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
			const requiresQuiz = await isUserInTopRanks(message.author.id, TOP_QUIZ_RANK_LIMIT);

			if (requiresQuiz) {
				const quizQuestion = pickRandomQuizQuestion();
				const quizToken = createQuizToken();
				const quizExpiresAt = Date.now() + CLAIM_QUIZ_TIMEOUT_MS;
				const quizEmbed = new EmbedBuilder()
					.setTitle("Top 2 Quiz Challenge")
					.setDescription(formatQuizPrompt(quizQuestion))
					.setFooter({
						text: `Answer within ${Math.floor(CLAIM_QUIZ_TIMEOUT_MS / 1000)} seconds`,
					});
				const buttonRow = new ActionRowBuilder().addComponents(
					QUIZ_BUTTON_LABELS.map((label, index) =>
						new ButtonBuilder()
							.setCustomId(buildQuizButtonCustomId(quizToken, index))
							.setLabel(label)
							.setStyle(ButtonStyle.Primary)
					)
				);
				const quizMessage = await message.channel.send({
					content: `${message.member}, answer correctly to claim this egg.`,
					embeds: [quizEmbed],
					components: [buttonRow],
					allowedMentions: { repliedUser: false, users: [] },
				});
				client.egg.pendingQuiz = {
					token: quizToken,
					userId: message.author.id,
					channelId: message.channel.id,
					quizMessageId: quizMessage.id,
					eggId: claimedEggId,
					followupId: claimedFollowupId,
					claimedIsGolden,
					totalClaimedEggs: rewardContext.totalClaimedEggs,
					streakBonus: rewardContext.streakBonus,
					nextStreakCount: rewardContext.nextStreakCount,
					shouldTrackStreak: rewardContext.shouldTrackStreak,
					correctIndex: quizQuestion.correctIndex,
					expiresAt: quizExpiresAt,
					lockToken,
				};
				clearPendingQuizTimer(client);
				client.egg.pendingQuizTimer = setTimeout(() => {
					resolvePendingQuizAsIncorrect(client, "timeout").catch((error) => {
						logger.error("Failed to resolve timed-out claim quiz", error);
					});
				}, CLAIM_QUIZ_TIMEOUT_MS);
				client.egg.claimLock.expiresAt = quizExpiresAt;
				shouldReleaseLock = false;

				logger.info(
					`Egg claim gated by quiz | user=${message.author.id} eggMessage=${claimedEggId} quizMessage=${quizMessage.id} reward=${rewardContext.totalClaimedEggs}`
				);
				return;
			}

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
