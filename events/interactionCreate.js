const { Egg } = require("../database/schemas/egg");
const functions = require("../utils/functions");
const logger = require("../utils/logger");
const {
	parseQuizButtonCustomId,
	CLAIM_QUIZ_TIMEOUT_MS,
	calculateClaimRewardContext,
	hasUserAttemptedPendingQuiz,
	markUserPendingQuizAttempt,
	clearPendingQuizTimer,
	clearActiveEggState,
	cleanupEggMessages,
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

	if (hasUserAttemptedPendingQuiz(pendingQuiz, interaction.user.id)) {
		await interaction
			.reply({
				content: "You already used your one attempt for this quiz.",
				ephemeral: true,
			})
			.catch(() => null);
		return;
	}

	markUserPendingQuizAttempt(pendingQuiz, interaction.user.id);

	const answeredCorrectly = parsed.choiceIndex === pendingQuiz.correctIndex;
	if (!answeredCorrectly) {
		await interaction
			.reply({
				content: "You submitted an answer.",
				ephemeral: true,
			})
			.catch(() => null);
		return;
	}

	await interaction.deferUpdate().catch(() => null);
	clearPendingQuizTimer(client);

	await functions.getUserData(Egg, interaction.user);
	const rewardContext = calculateClaimRewardContext({
		client,
		userId: interaction.user.id,
		claimedIsDroppedEgg: Boolean(pendingQuiz.claimedIsDroppedEgg),
		claimedIsGolden: Boolean(pendingQuiz.claimedIsGolden),
	});
	await Egg.increment(
		{ point: rewardContext.totalClaimedEggs },
		{ where: { userid: interaction.user.id } }
	);
	if (rewardContext.shouldTrackStreak) {
		client.egg.claimStreak = {
			userId: interaction.user.id,
			count: rewardContext.nextStreakCount,
		};
	}

	await interaction.message.edit({ components: [] }).catch(() => null);
	await cleanupEggMessages(interaction.channel, pendingQuiz.eggId, pendingQuiz.followupId);
	await clearActiveEggState(client, pendingQuiz.eggId);

	if (client.egg.claimLock && client.egg.claimLock.token === pendingQuiz.lockToken) {
		client.egg.claimLock = null;
	}

	const memberMention = `<@${interaction.user.id}>`;
	await interaction.channel.send({
		content: pendingQuiz.claimedIsGolden
			? `${memberMention} answered correctly first and claimed a GOLDEN egg! ✨ \`+${rewardContext.totalClaimedEggs}\` eggs`
			: `${memberMention} answered correctly first and claimed the egg! \`+${rewardContext.totalClaimedEggs}\` eggs`,
		allowedMentions: { repliedUser: false, users: [] },
	});

	if (rewardContext.streakBonus > 0) {
		await interaction.channel.send(
			`Streak bonus: \`+${rewardContext.streakBonus}\` (streak ${rewardContext.nextStreakCount})`
		);
	}

	logger.info(
		`Egg quiz resolved | winner=${interaction.user.id} delta=${rewardContext.totalClaimedEggs} eggMessage=${pendingQuiz.eggId} quizTimeoutMs=${CLAIM_QUIZ_TIMEOUT_MS}`
	);
};
