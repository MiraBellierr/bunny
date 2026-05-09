const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");
const { rollClaimedEggs } = require("./egg");
const { GENERAL_KNOWLEDGE_QUESTION_BANK } = require("./quizQuestionBank");

const DEFAULT_STREAK_TIER_SIZE = 5;
const CLAIM_QUIZ_TIMEOUT_MS = 25 * 1000;
const CLAIM_QUIZ_BUTTON_PREFIX = "claimquiz";
const QUIZ_BUTTON_LABELS = ["A", "B", "C", "D"];
const SPAWN_QUIZ_CHANCE = 0.5;

const getClaimStreakTierSize = () => {
	const parsedTierSize = Number.parseInt(process.env.CLAIM_STREAK_TIER_SIZE || "", 10);
	if (Number.isNaN(parsedTierSize) || parsedTierSize < 1) {
		return DEFAULT_STREAK_TIER_SIZE;
	}

	return parsedTierSize;
};

const calculateClaimRewardContext = ({
	client,
	userId,
	claimedIsDroppedEgg,
	claimedIsGolden,
}) => {
	const currentStreak = client.egg.claimStreak || { userId: "", count: 0 };
	const shouldTrackStreak = !claimedIsDroppedEgg;
	const nextStreakCount = shouldTrackStreak
		? currentStreak.userId === userId
			? currentStreak.count + 1
			: 1
		: currentStreak.count;
	const streakTierSize = getClaimStreakTierSize();
	const streakBonus = shouldTrackStreak ? Math.floor(nextStreakCount / streakTierSize) : 0;
	const claimedEggs = claimedIsDroppedEgg ? 1 : rollClaimedEggs(claimedIsGolden);
	const totalClaimedEggs = claimedEggs + streakBonus;

	return {
		claimedEggs,
		streakBonus,
		shouldTrackStreak,
		nextStreakCount,
		totalClaimedEggs,
	};
};

const shuffle = (values) => {
	const result = [...values];
	for (let i = result.length - 1; i > 0; i -= 1) {
		const randomIndex = Math.floor(Math.random() * (i + 1));
		[result[i], result[randomIndex]] = [result[randomIndex], result[i]];
	}
	return result;
};

const pickRandomQuizQuestion = () => {
	const source =
		GENERAL_KNOWLEDGE_QUESTION_BANK[
			Math.floor(Math.random() * GENERAL_KNOWLEDGE_QUESTION_BANK.length)
		];
	const choices = shuffle([source.answer, ...(source.wrongAnswers || []).slice(0, 3)]);
	const correctIndex = choices.findIndex((choice) => choice === source.answer);

	return {
		prompt: source.prompt,
		choices,
		correctIndex,
	};
};

const formatQuizPrompt = (question) => {
	const lines = question.choices.map(
		(choice, index) => `**${QUIZ_BUTTON_LABELS[index]}.** ${choice}`
	);
	return `${question.prompt}\n${lines.join("\n")}`;
};

const createQuizToken = () =>
	`${Date.now().toString(36)}-${Math.floor(Math.random() * 1_000_000).toString(36)}`;

const buildQuizButtonCustomId = (token, choiceIndex) =>
	`${CLAIM_QUIZ_BUTTON_PREFIX}:${token}:${choiceIndex}`;

const parseQuizButtonCustomId = (customId = "") => {
	const [prefix, token, rawChoiceIndex] = customId.split(":");
	if (prefix !== CLAIM_QUIZ_BUTTON_PREFIX || !token) {
		return null;
	}

	const choiceIndex = Number.parseInt(rawChoiceIndex || "", 10);
	if (Number.isNaN(choiceIndex) || choiceIndex < 0 || choiceIndex > 3) {
		return null;
	}

	return { token, choiceIndex };
};

const shouldSpawnQuizChallenge = () => Math.random() < SPAWN_QUIZ_CHANCE;

const startSpawnQuizChallenge = async ({
	client,
	channel,
	triggerMessage = "A quiz challenge appeared!",
	eggId = "",
	followupId = "",
	claimedIsGolden = false,
	claimedIsDroppedEgg = false,
	lockToken = "",
}) => {
	const quizQuestion = pickRandomQuizQuestion();
	const quizToken = createQuizToken();
	const quizExpiresAt = Date.now() + CLAIM_QUIZ_TIMEOUT_MS;
	const quizCountdown = `<t:${Math.floor(quizExpiresAt / 1000)}:R>`;
	const quizEmbed = new EmbedBuilder()
		.setTitle("Spawn Quiz Challenge")
		.setDescription(`${formatQuizPrompt(quizQuestion)}\n\nTime remaining: ${quizCountdown}`);
	const buttonRow = new ActionRowBuilder().addComponents(
		quizQuestion.choices.map((_, index) =>
			new ButtonBuilder()
				.setCustomId(buildQuizButtonCustomId(quizToken, index))
				.setLabel(QUIZ_BUTTON_LABELS[index])
				.setStyle(ButtonStyle.Primary)
		)
	);
	const quizMessage = await channel.send({
		content: `${triggerMessage} First correct answer claims the egg.`,
		embeds: [quizEmbed],
		components: [buttonRow],
		allowedMentions: { repliedUser: false, users: [] },
	});

	client.egg.pendingQuiz = {
		token: quizToken,
		channelId: channel.id,
		quizMessageId: quizMessage.id,
		eggId,
		followupId,
		claimedIsGolden,
		claimedIsDroppedEgg,
		choiceCount: quizQuestion.choices.length,
		correctIndex: quizQuestion.correctIndex,
		expiresAt: quizExpiresAt,
		lockToken,
		attemptedUserIds: [],
	};
	clearPendingQuizTimer(client);
	client.egg.pendingQuizTimer = setTimeout(() => {
		resolvePendingQuizAsIncorrect(client, "timeout").catch(() => null);
	}, CLAIM_QUIZ_TIMEOUT_MS);

	return {
		quizMessage,
		quizToken,
		quizExpiresAt,
		choiceCount: quizQuestion.choices.length,
	};
};

const hasUserAttemptedPendingQuiz = (pendingQuiz, userId) => {
	if (!pendingQuiz || !userId || !Array.isArray(pendingQuiz.attemptedUserIds)) {
		return false;
	}

	return pendingQuiz.attemptedUserIds.includes(userId);
};

const markUserPendingQuizAttempt = (pendingQuiz, userId) => {
	if (!pendingQuiz || !userId) {
		return false;
	}

	if (!Array.isArray(pendingQuiz.attemptedUserIds)) {
		pendingQuiz.attemptedUserIds = [];
	}

	if (pendingQuiz.attemptedUserIds.includes(userId)) {
		return false;
	}

	pendingQuiz.attemptedUserIds.push(userId);
	return true;
};

const clearPendingQuizTimer = (client) => {
	if (client?.egg?.pendingQuizTimer) {
		clearTimeout(client.egg.pendingQuizTimer);
		client.egg.pendingQuizTimer = null;
	}
};

const clearPendingQuizIfExpired = (client, now = Date.now()) => {
	if (!client.egg.pendingQuiz || now <= client.egg.pendingQuiz.expiresAt) {
		return false;
	}

	clearPendingQuizTimer(client);
	const pendingQuiz = client.egg.pendingQuiz;
	client.egg.pendingQuiz = null;
	if (client.egg.claimLock && client.egg.claimLock.token === pendingQuiz.lockToken) {
		client.egg.claimLock = null;
	}

	return true;
};

const clearActiveEggState = async (client, expectedEggId) => {
	if (client.egg.id === expectedEggId) {
		client.egg.id = "";
		client.egg.drop = "";
		client.egg.followupId = "";
		client.egg.isGolden = false;
		client.egg.claimColor = "";
	}
	client.egg.pendingQuiz = null;
	clearPendingQuizTimer(client);
	await client.persistEggRuntimeState?.();
};

const cleanupEggMessages = async (channel, eggId, followupId) => {
	if (!channel?.messages?.fetch) {
		return;
	}

	const eggMessage = await channel.messages.fetch(eggId).catch(() => null);
	if (eggMessage) {
		await eggMessage.delete().catch(() => null);
	}

	const followupMessage = await channel.messages.fetch(followupId).catch(() => null);
	if (followupMessage) {
		await followupMessage.delete().catch(() => null);
	}
};

const resolvePendingQuizAsIncorrect = async (client, reason = "incorrect") => {
	const pendingQuiz = client.egg.pendingQuiz;
	if (!pendingQuiz) {
		return null;
	}

	clearPendingQuizTimer(client);
	client.egg.pendingQuiz = null;
	if (client.egg.claimLock && client.egg.claimLock.token === pendingQuiz.lockToken) {
		client.egg.claimLock = null;
	}

	const channel = await client.channels.fetch(pendingQuiz.channelId).catch(() => null);
	if (channel) {
		const quizMessage = await channel.messages.fetch(pendingQuiz.quizMessageId).catch(() => null);
		if (quizMessage) {
			await quizMessage.edit({ components: [] }).catch(() => null);
		}

		if (reason === "timeout") {
			await cleanupEggMessages(channel, pendingQuiz.eggId, pendingQuiz.followupId);
			await channel.send({
				content: "No one answered correctly in time. The egg disappeared.",
				allowedMentions: { repliedUser: false, users: [] },
			});
		}
	}

	await clearActiveEggState(client, pendingQuiz.eggId);

	return {
		pendingQuiz,
	};
};

module.exports = {
	CLAIM_QUIZ_TIMEOUT_MS,
	QUIZ_BUTTON_LABELS,
	getClaimStreakTierSize,
	calculateClaimRewardContext,
	pickRandomQuizQuestion,
	formatQuizPrompt,
	createQuizToken,
	buildQuizButtonCustomId,
	parseQuizButtonCustomId,
	shouldSpawnQuizChallenge,
	startSpawnQuizChallenge,
	hasUserAttemptedPendingQuiz,
	markUserPendingQuizAttempt,
	clearPendingQuizTimer,
	clearPendingQuizIfExpired,
	clearActiveEggState,
	cleanupEggMessages,
	resolvePendingQuizAsIncorrect,
};
