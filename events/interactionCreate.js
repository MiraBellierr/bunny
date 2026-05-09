const { Egg } = require("../database/schemas/egg");
const logger = require("../utils/logger");
const {
	parseQuizButtonCustomId,
	CLAIM_QUIZ_TIMEOUT_MS,
	clearPendingQuizTimer,
	clearActiveEggState,
	cleanupEggMessages,
	applyPenaltyWithZeroFloor,
	resetClaimStreakForUser,
	resolvePendingQuizAsIncorrect,
} = require("../utils/claimQuiz");

module.exports = async (client, interaction) => {
	if (!interaction.isButton()) return;

	const parsed = parseQuizButtonCustomId(interaction.customId);
	if (!parsed) return;

	const pendingQuiz = client.egg.pendingQuiz;
	if (!pendingQuiz || pendingQuiz.token !== parsed.token) {
		await interaction
			.reply({
				content: "This quiz is no longer active.",
				ephemeral: true,
			})
			.catch(() => null);
		return;
	}

	if (Date.now() > pendingQuiz.expiresAt) {
		await interaction
			.reply({
				content: "Time is up. This was counted as an incorrect answer.",
				ephemeral: true,
			})
			.catch(() => null);
		await resolvePendingQuizAsIncorrect(client, "timeout");
		return;
	}

	const choiceCount =
		Number.isInteger(pendingQuiz.choiceCount) && pendingQuiz.choiceCount > 0
			? pendingQuiz.choiceCount
			: 4;
	if (parsed.choiceIndex >= choiceCount) {
		await interaction
			.reply({
				content: "That answer option is not available for this quiz.",
				ephemeral: true,
			})
			.catch(() => null);
		return;
	}

	if (interaction.user.id !== pendingQuiz.userId) {
		await interaction
			.reply({
				content: "Only the claimant can answer this question.",
				ephemeral: true,
			})
			.catch(() => null);
		return;
	}

	const answeredCorrectly = parsed.choiceIndex === pendingQuiz.correctIndex;
	await interaction.deferUpdate().catch(() => null);
	clearPendingQuizTimer(client);

	let resultDelta = 0;
	if (answeredCorrectly) {
		const incrementResult = await Egg.increment(
			{ point: pendingQuiz.totalClaimedEggs },
			{ where: { userid: pendingQuiz.userId } }
		);
		if (Array.isArray(incrementResult) && incrementResult[0] === 0) {
			const userEgg = await Egg.findOne({ where: { userid: pendingQuiz.userId } });
			const currentEggs = Number(userEgg?.get("point") || 0);
			await Egg.update(
				{ point: currentEggs + pendingQuiz.totalClaimedEggs },
				{ where: { userid: pendingQuiz.userId } }
			);
		}
		if (pendingQuiz.shouldTrackStreak) {
			client.egg.claimStreak = {
				userId: pendingQuiz.userId,
				count: pendingQuiz.nextStreakCount,
			};
		}
		resultDelta = pendingQuiz.totalClaimedEggs;
	} else {
		resultDelta = await applyPenaltyWithZeroFloor(
			pendingQuiz.userId,
			pendingQuiz.totalClaimedEggs
		);
		resetClaimStreakForUser(client, pendingQuiz.userId);
	}

	if (interaction?.message && typeof interaction.message.edit === "function") {
		try {
			await interaction.message.edit({ components: [] });
		} catch {
			// ignore quiz message update errors
		}
	}
	await cleanupEggMessages(interaction.channel, pendingQuiz.eggId, pendingQuiz.followupId);
	await clearActiveEggState(client, pendingQuiz.eggId);

	if (client.egg.claimLock && client.egg.claimLock.token === pendingQuiz.lockToken) {
		client.egg.claimLock = null;
	}

	const memberMention = `<@${pendingQuiz.userId}>`;
	if (answeredCorrectly) {
		await interaction.channel.send({
			content: pendingQuiz.claimedIsGolden
				? `${memberMention} answered correctly and claimed a GOLDEN egg! ✨ \`+${resultDelta}\` eggs`
				: `${memberMention} answered correctly and claimed the egg! \`+${resultDelta}\` eggs`,
			allowedMentions: { repliedUser: false, users: [] },
		});

		if (pendingQuiz.streakBonus > 0) {
			await interaction.channel.send(
				`Streak bonus: \`+${pendingQuiz.streakBonus}\` (streak ${pendingQuiz.nextStreakCount})`
			);
		}
	} else {
		await interaction.channel.send({
			content: `${memberMention} answered incorrectly and lost \`-${resultDelta}\` eggs.`,
			allowedMentions: { repliedUser: false, users: [] },
		});
	}

	logger.info(
		`Egg quiz resolved | user=${pendingQuiz.userId} correct=${answeredCorrectly} delta=${resultDelta} eggMessage=${pendingQuiz.eggId} quizTimeoutMs=${CLAIM_QUIZ_TIMEOUT_MS}`
	);
};
