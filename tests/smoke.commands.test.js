const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

const ROOT = path.resolve(__dirname, "..");
const CLAIM_COMMAND_PATH = path.join(ROOT, "commands/general/claim.js");
const EDIT_COMMAND_PATH = path.join(ROOT, "commands/general/edit.js");
const LB_COMMAND_PATH = path.join(ROOT, "commands/general/lb.js");
const RATE_COMMAND_PATH = path.join(ROOT, "commands/general/rate.js");
const RESET_COMMAND_PATH = path.join(ROOT, "commands/general/reset.js");
const SPAWN_COMMAND_PATH = path.join(ROOT, "commands/general/spawn.js");
const INTERACTION_EVENT_PATH = path.join(ROOT, "events/interactionCreate.js");
const AUTH_UTIL_PATH = path.join(ROOT, "utils/auth.js");
const EGG_RUNTIME_STATE_UTIL_PATH = path.join(ROOT, "utils/eggRuntimeState.js");
const { getEffectiveSpawnRate } = require("../utils/spawnRate");

const FUNCTIONS_MODULE_PATH = require.resolve(path.join(ROOT, "utils/functions.js"));
const EGG_SCHEMA_MODULE_PATH = require.resolve(path.join(ROOT, "database/schemas/egg.js"));
const EGG_MODULE_PATH = require.resolve(path.join(ROOT, "utils/egg.js"));
const EGG_RUNTIME_STATE_SCHEMA_MODULE_PATH = require.resolve(
	path.join(ROOT, "database/schemas/eggRuntimeState.js")
);
const LOGGER_MODULE_PATH = require.resolve(path.join(ROOT, "utils/logger.js"));

const createChannel = (id) => {
	let sentCount = 0;
	const sentPayloads = [];
	const messageMap = new Map();

	return {
		id,
		sentPayloads,
		messageMap,
		send: async (payload) => {
			sentCount += 1;
			sentPayloads.push(payload);
			return { id: `m${sentCount}` };
		},
		messages: {
			fetch: async (messageId) => {
				if (!messageMap.has(messageId)) {
					throw new Error(`Message ${messageId} not found`);
				}

				return messageMap.get(messageId);
			},
		},
	};
};

const loadModuleWithMocks = (targetPath, mocks) => {
	const originalLoad = Module._load;

	Module._load = function patchedLoad(request, parent, isMain) {
		const resolvedRequest = Module._resolveFilename(request, parent, isMain);
		if (Object.prototype.hasOwnProperty.call(mocks, resolvedRequest)) {
			return mocks[resolvedRequest];
		}

		return originalLoad.apply(this, arguments);
	};

	try {
		for (const cachePath of Object.keys(require.cache)) {
			if (cachePath.startsWith(ROOT)) {
				delete require.cache[cachePath];
			}
		}

		delete require.cache[require.resolve(targetPath)];
		return require(targetPath);
	} finally {
		Module._load = originalLoad;
	}
};

test("claim smoke: successful claim increments points, clears egg state, and sends result", async () => {
	process.env.CHANNEL = "chan-1";
	const channel = createChannel("chan-1");
	const eggDeleteState = { deleted: false };
	const followupDeleteState = { deleted: false };

	channel.messageMap.set("egg-1", {
		delete: async () => {
			eggDeleteState.deleted = true;
		},
	});
	channel.messageMap.set("followup-1", {
		delete: async () => {
			followupDeleteState.deleted = true;
		},
	});

	const incrementCalls = [];
	const model = {
		increment: async (...args) => {
			incrementCalls.push(args);
		},
		findAll: async () => [],
	};

	const claimCommand = loadModuleWithMocks(CLAIM_COMMAND_PATH, {
		[FUNCTIONS_MODULE_PATH]: {
			getUserData: async () => ({ get: () => 0 }),
		},
		[EGG_SCHEMA_MODULE_PATH]: { Egg: model },
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});

	const client = {
		channels: { fetch: async () => channel },
		egg: { id: "egg-1", followupId: "followup-1", drop: "", claimLock: null },
	};
	const message = {
		id: "msg-claim-1",
		author: { id: "user-1" },
		member: "<@user-1>",
		channel,
	};

	const originalRandom = Math.random;
	Math.random = () => 0;

	try {
		await claimCommand.run(client, message);
	} finally {
		Math.random = originalRandom;
	}

	assert.equal(incrementCalls.length, 1);
	assert.deepEqual(incrementCalls[0][0], { point: 1 });
	assert.deepEqual(incrementCalls[0][1], { where: { userid: "user-1" } });
	assert.equal(client.egg.id, "");
	assert.equal(client.egg.followupId, "");
	assert.equal(client.egg.drop, "");
	assert.equal(client.egg.claimLock, null);
	assert.equal(eggDeleteState.deleted, true);
	assert.equal(followupDeleteState.deleted, true);
	assert.equal(channel.sentPayloads.length, 1);
	assert.match(channel.sentPayloads[0].content, /has claimed the egg!/);
});

test("claim smoke: active lock blocks duplicate claim attempts", async () => {
	process.env.CHANNEL = "chan-1";
	const channel = createChannel("chan-1");
	let incrementCallCount = 0;

	const claimCommand = loadModuleWithMocks(CLAIM_COMMAND_PATH, {
		[FUNCTIONS_MODULE_PATH]: {
			getUserData: async () => ({ get: () => 0 }),
		},
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				increment: async () => {
					incrementCallCount += 1;
				},
				findAll: async () => [],
			},
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});

	const client = {
		channels: { fetch: async () => channel },
		egg: {
			id: "egg-1",
			followupId: "followup-1",
			drop: "",
			claimLock: {
				token: "existing-lock",
				eggId: "egg-1",
				expiresAt: Date.now() + 5000,
			},
		},
	};
	const message = {
		id: "msg-claim-2",
		author: { id: "user-2" },
		member: "<@user-2>",
		channel,
	};

	await claimCommand.run(client, message);

	assert.equal(incrementCallCount, 0);
	assert.equal(channel.sentPayloads.length, 0);
});

test("claim smoke: streak tier adds bonus points", async () => {
	process.env.CHANNEL = "chan-1";
	process.env.CLAIM_STREAK_TIER_SIZE = "2";
	const channel = createChannel("chan-1");
	const eggDeleteState = { deleted: false };
	const followupDeleteState = { deleted: false };

	channel.messageMap.set("egg-1", {
		delete: async () => {
			eggDeleteState.deleted = true;
		},
	});
	channel.messageMap.set("followup-1", {
		delete: async () => {
			followupDeleteState.deleted = true;
		},
	});

	const incrementCalls = [];
	const claimCommand = loadModuleWithMocks(CLAIM_COMMAND_PATH, {
		[FUNCTIONS_MODULE_PATH]: {
			getUserData: async () => ({ get: () => 0 }),
		},
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				increment: async (...args) => {
					incrementCalls.push(args);
				},
				findAll: async () => [],
			},
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});

	const client = {
		channels: { fetch: async () => channel },
		egg: {
			id: "egg-1",
			followupId: "followup-1",
			drop: "",
			isGolden: false,
			claimStreak: {
				userId: "user-1",
				count: 1,
			},
		},
	};
	const message = {
		id: "msg-claim-3",
		author: { id: "user-1" },
		member: "<@user-1>",
		channel,
	};

	const originalRandom = Math.random;
	Math.random = () => 0;

	try {
		await claimCommand.run(client, message);
	} finally {
		Math.random = originalRandom;
	}

	assert.equal(incrementCalls.length, 1);
	assert.deepEqual(incrementCalls[0][0], { point: 2 });
	assert.deepEqual(incrementCalls[0][1], { where: { userid: "user-1" } });
	assert.equal(client.egg.claimStreak.userId, "user-1");
	assert.equal(client.egg.claimStreak.count, 2);
	assert.equal(eggDeleteState.deleted, true);
	assert.equal(followupDeleteState.deleted, true);
	assert.equal(channel.sentPayloads.length, 2);
	assert.match(channel.sentPayloads[0].content, /\+2/);
	assert.match(channel.sentPayloads[1], /Streak bonus: `\+1`/);
});

test("claim smoke: dropped eggs always grant exactly one and skip streak bonuses", async () => {
	process.env.CHANNEL = "chan-1";
	process.env.CLAIM_STREAK_TIER_SIZE = "1";
	const channel = createChannel("chan-1");
	const eggDeleteState = { deleted: false };
	const followupDeleteState = { deleted: false };

	channel.messageMap.set("egg-drop-1", {
		delete: async () => {
			eggDeleteState.deleted = true;
		},
	});
	channel.messageMap.set("followup-drop-1", {
		delete: async () => {
			followupDeleteState.deleted = true;
		},
	});

	const incrementCalls = [];
	const claimCommand = loadModuleWithMocks(CLAIM_COMMAND_PATH, {
		[FUNCTIONS_MODULE_PATH]: {
			getUserData: async () => ({ get: () => 0 }),
		},
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				increment: async (...args) => {
					incrementCalls.push(args);
				},
				findAll: async () => [],
			},
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});

	const client = {
		channels: { fetch: async () => channel },
		egg: {
			id: "egg-drop-1",
			followupId: "followup-drop-1",
			drop: "dropper-1",
			isGolden: true,
			claimStreak: {
				userId: "user-2",
				count: 7,
			},
		},
	};
	const message = {
		id: "msg-claim-drop-1",
		author: { id: "user-2" },
		member: "<@user-2>",
		channel,
	};

	const originalRandom = Math.random;
	Math.random = () => 0.999;

	try {
		await claimCommand.run(client, message);
	} finally {
		Math.random = originalRandom;
	}

	assert.equal(incrementCalls.length, 1);
	assert.deepEqual(incrementCalls[0][0], { point: 1 });
	assert.deepEqual(incrementCalls[0][1], { where: { userid: "user-2" } });
	assert.equal(client.egg.claimStreak.userId, "user-2");
	assert.equal(client.egg.claimStreak.count, 7);
	assert.equal(client.egg.id, "");
	assert.equal(client.egg.followupId, "");
	assert.equal(client.egg.drop, "");
	assert.equal(client.egg.isGolden, false);
	assert.equal(eggDeleteState.deleted, true);
	assert.equal(followupDeleteState.deleted, true);
	assert.equal(channel.sentPayloads.length, 1);
	assert.match(channel.sentPayloads[0].content, /has claimed the egg!/);
	assert.match(channel.sentPayloads[0].content, /`\+1` eggs/);
});

test("claim smoke: top-2 claimant is quiz-gated before rewards are applied", async () => {
	process.env.CHANNEL = "chan-1";
	const channel = createChannel("chan-1");
	let incrementCallCount = 0;
	const claimCommand = loadModuleWithMocks(CLAIM_COMMAND_PATH, {
		[FUNCTIONS_MODULE_PATH]: {
			getUserData: async () => ({ get: () => 0 }),
		},
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				increment: async () => {
					incrementCallCount += 1;
				},
				findAll: async () => [
					{
						get: () => "user-1",
					},
					{
						get: () => "user-2",
					},
				],
			},
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});

	const client = {
		channels: { fetch: async () => channel },
		egg: {
			id: "egg-top2-1",
			followupId: "followup-top2-1",
			drop: "",
			isGolden: false,
			claimLock: null,
			claimStreak: {
				userId: "",
				count: 0,
			},
			pendingQuiz: null,
		},
	};
	const message = {
		id: "msg-claim-top2-1",
		author: { id: "user-1" },
		member: "<@user-1>",
		channel,
	};

	await claimCommand.run(client, message);

	assert.equal(incrementCallCount, 0);
	assert.equal(channel.sentPayloads.length, 1);
	assert.equal(Array.isArray(channel.sentPayloads[0].components), true);
	assert.equal(channel.sentPayloads[0].components.length, 1);
	assert.equal(client.egg.pendingQuiz.userId, "user-1");
	assert.equal(client.egg.pendingQuiz.eggId, "egg-top2-1");
	assert.equal(client.egg.pendingQuiz.followupId, "followup-top2-1");
	assert.equal(typeof client.egg.pendingQuiz.token, "string");
	assert.ok(client.egg.claimLock.expiresAt >= client.egg.pendingQuiz.expiresAt);
});

test("interaction smoke: correct quiz answer awards eggs and clears active egg state", async () => {
	const channel = createChannel("chan-1");
	let incrementPayload = null;
	let persisted = false;
	let quizButtonsRemoved = false;
	let deferUpdateCount = 0;
	const eggDeleteState = { deleted: false };
	const followupDeleteState = { deleted: false };
	channel.messageMap.set("egg-quiz-1", {
		delete: async () => {
			eggDeleteState.deleted = true;
		},
	});
	channel.messageMap.set("followup-quiz-1", {
		delete: async () => {
			followupDeleteState.deleted = true;
		},
	});

	const interactionHandler = loadModuleWithMocks(INTERACTION_EVENT_PATH, {
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				increment: async (...args) => {
					incrementPayload = args;
				},
				findOne: async () => ({ get: () => 0 }),
				decrement: async () => {},
			},
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});

	const client = {
		egg: {
			id: "egg-quiz-1",
			followupId: "followup-quiz-1",
			drop: "",
			isGolden: true,
			claimLock: {
				token: "lock-quiz-1",
				eggId: "egg-quiz-1",
				expiresAt: Date.now() + 5000,
			},
			claimStreak: {
				userId: "",
				count: 0,
			},
			pendingQuiz: {
				token: "token-quiz-1",
				userId: "user-1",
				channelId: "chan-1",
				quizMessageId: "quiz-msg-1",
				eggId: "egg-quiz-1",
				followupId: "followup-quiz-1",
				claimedIsGolden: true,
				totalClaimedEggs: 4,
				streakBonus: 1,
				nextStreakCount: 2,
				shouldTrackStreak: true,
				correctIndex: 2,
				expiresAt: Date.now() + 30000,
				lockToken: "lock-quiz-1",
			},
		},
		persistEggRuntimeState: async () => {
			persisted = true;
		},
	};
	const interaction = {
		isButton: () => true,
		customId: "claimquiz:token-quiz-1:2",
		user: { id: "user-1" },
		channel,
		message: {
			edit: async (payload) => {
				quizButtonsRemoved =
					Array.isArray(payload?.components) && payload.components.length === 0;
			},
		},
		deferUpdate: async () => {
			deferUpdateCount += 1;
		},
		reply: async () => {},
		update: async () => {},
	};

	await interactionHandler(client, interaction);

	assert.deepEqual(incrementPayload[0], { point: 4 });
	assert.deepEqual(incrementPayload[1], { where: { userid: "user-1" } });
	assert.equal(client.egg.claimStreak.userId, "user-1");
	assert.equal(client.egg.claimStreak.count, 2);
	assert.equal(client.egg.id, "");
	assert.equal(client.egg.followupId, "");
	assert.equal(client.egg.pendingQuiz, null);
	assert.equal(client.egg.claimLock, null);
	assert.equal(quizButtonsRemoved, true);
	assert.equal(eggDeleteState.deleted, true);
	assert.equal(followupDeleteState.deleted, true);
	assert.equal(persisted, true);
	assert.equal(deferUpdateCount, 1);
	assert.match(channel.sentPayloads[0].content, /answered correctly/);
	assert.match(channel.sentPayloads[1], /Streak bonus: `\+1`/);
});

test("interaction smoke: wrong quiz answer deducts eggs with zero floor clamp", async () => {
	const channel = createChannel("chan-1");
	let decrementPayload = null;
	channel.messageMap.set("egg-quiz-2", {
		delete: async () => {},
	});
	channel.messageMap.set("followup-quiz-2", {
		delete: async () => {},
	});

	const interactionHandler = loadModuleWithMocks(INTERACTION_EVENT_PATH, {
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				increment: async () => {},
				findOne: async () => ({ get: () => 2 }),
				decrement: async (...args) => {
					decrementPayload = args;
				},
			},
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});

	const client = {
		egg: {
			id: "egg-quiz-2",
			followupId: "followup-quiz-2",
			drop: "",
			isGolden: false,
			claimLock: {
				token: "lock-quiz-2",
				eggId: "egg-quiz-2",
				expiresAt: Date.now() + 5000,
			},
			claimStreak: {
				userId: "user-9",
				count: 9,
			},
			pendingQuiz: {
				token: "token-quiz-2",
				userId: "user-1",
				channelId: "chan-1",
				quizMessageId: "quiz-msg-2",
				eggId: "egg-quiz-2",
				followupId: "followup-quiz-2",
				claimedIsGolden: false,
				totalClaimedEggs: 5,
				streakBonus: 0,
				nextStreakCount: 1,
				shouldTrackStreak: true,
				correctIndex: 3,
				expiresAt: Date.now() + 30000,
				lockToken: "lock-quiz-2",
			},
		},
		persistEggRuntimeState: async () => {},
	};
	const interaction = {
		isButton: () => true,
		customId: "claimquiz:token-quiz-2:1",
		user: { id: "user-1" },
		channel,
		message: {
			edit: async () => {},
		},
		deferUpdate: async () => {},
		reply: async () => {},
		update: async () => {},
	};

	await interactionHandler(client, interaction);

	assert.deepEqual(decrementPayload[0], { point: 2 });
	assert.deepEqual(decrementPayload[1], { where: { userid: "user-1" } });
	assert.equal(client.egg.pendingQuiz, null);
	assert.equal(client.egg.claimLock, null);
	assert.match(channel.sentPayloads[0].content, /answered incorrectly/);
	assert.match(channel.sentPayloads[0].content, /`-2` eggs/);
});

test("interaction smoke: only the claimant can answer the quiz", async () => {
	const channel = createChannel("chan-1");
	let incrementCallCount = 0;
	let decrementCallCount = 0;
	let replyPayload = null;
	let quizMessageDeleted = false;

	const interactionHandler = loadModuleWithMocks(INTERACTION_EVENT_PATH, {
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				increment: async () => {
					incrementCallCount += 1;
				},
				findOne: async () => ({ get: () => 10 }),
				decrement: async () => {
					decrementCallCount += 1;
				},
			},
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});

	const client = {
		egg: {
			id: "egg-quiz-3",
			followupId: "followup-quiz-3",
			drop: "",
			isGolden: false,
			claimLock: {
				token: "lock-quiz-3",
				eggId: "egg-quiz-3",
				expiresAt: Date.now() + 5000,
			},
			claimStreak: {
				userId: "",
				count: 0,
			},
			pendingQuiz: {
				token: "token-quiz-3",
				userId: "user-1",
				channelId: "chan-1",
				quizMessageId: "quiz-msg-3",
				eggId: "egg-quiz-3",
				followupId: "followup-quiz-3",
				claimedIsGolden: false,
				totalClaimedEggs: 3,
				streakBonus: 0,
				nextStreakCount: 1,
				shouldTrackStreak: true,
				correctIndex: 0,
				expiresAt: Date.now() + 30000,
				lockToken: "lock-quiz-3",
			},
		},
		persistEggRuntimeState: async () => {},
	};
	const interaction = {
		isButton: () => true,
		customId: "claimquiz:token-quiz-3:0",
		user: { id: "intruder-user-2" },
		channel,
		message: {
			delete: async () => {
				quizMessageDeleted = true;
			},
		},
		deferUpdate: async () => {},
		reply: async (payload) => {
			replyPayload = payload;
		},
		update: async () => {},
	};

	await interactionHandler(client, interaction);

	assert.equal(incrementCallCount, 0);
	assert.equal(decrementCallCount, 0);
	assert.equal(quizMessageDeleted, false);
	assert.equal(client.egg.pendingQuiz.userId, "user-1");
	assert.equal(client.egg.claimLock.token, "lock-quiz-3");
	assert.equal(channel.sentPayloads.length, 0);
	assert.equal(replyPayload?.ephemeral, true);
	assert.match(replyPayload?.content || "", /Only the claimant can answer/);
});

test("reset smoke: requires confirmation before truncating database", async () => {
	process.env.PREFIX = ".";
	process.env.BOT_OWNER_IDS = "548050617889980426";
	const channel = createChannel("chan-1");
	let truncateCallCount = 0;
	const resetCommand = loadModuleWithMocks(RESET_COMMAND_PATH, {
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				truncate: async () => {
					truncateCallCount += 1;
				},
			},
		},
	});

	const client = {};
	const message = {
		author: { id: "548050617889980426" },
		channel,
	};

	await resetCommand.run(client, message, []);

	assert.equal(truncateCallCount, 0);
	assert.equal(channel.sentPayloads.length, 1);
	assert.match(channel.sentPayloads[0], /reset confirm/);
	assert.equal(typeof client.resetConfirmation, "object");
});

test("reset smoke: confirm step truncates database when pending confirmation exists", async () => {
	process.env.PREFIX = ".";
	process.env.BOT_OWNER_IDS = "548050617889980426";
	const channel = createChannel("chan-1");
	let truncateCallCount = 0;
	const resetCommand = loadModuleWithMocks(RESET_COMMAND_PATH, {
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				truncate: async () => {
					truncateCallCount += 1;
				},
			},
		},
	});

	const client = {};
	const message = {
		author: { id: "548050617889980426" },
		channel,
	};

	await resetCommand.run(client, message, []);
	await resetCommand.run(client, message, ["confirm"]);

	assert.equal(truncateCallCount, 1);
	assert.equal(client.resetConfirmation, null);
	assert.equal(channel.sentPayloads.length, 2);
	assert.equal(channel.sentPayloads[1], "Database reset");
});

test("rate smoke: no args returns current rate and exits", async () => {
	process.env.BOT_OWNER_IDS = "owner-1";
	const channel = createChannel("chan-1");
	const rateCommand = loadModuleWithMocks(RATE_COMMAND_PATH, {});
	const client = {
		egg: {
			rate: 15,
		},
	};
	const message = {
		author: { id: "owner-1" },
		channel,
	};

	await rateCommand.run(client, message, []);

	assert.equal(client.egg.rate, 15);
	assert.equal(channel.sentPayloads.length, 1);
	assert.equal(channel.sentPayloads[0], "The spawn rate: 15%");
});

test("rate smoke: values are clamped between 0 and 100", async () => {
	process.env.BOT_OWNER_IDS = "owner-1";
	const channel = createChannel("chan-1");
	const rateCommand = loadModuleWithMocks(RATE_COMMAND_PATH, {});
	const client = {
		egg: {
			rate: 15,
		},
	};
	const message = {
		author: { id: "owner-1" },
		channel,
	};

	await rateCommand.run(client, message, ["250"]);
	assert.equal(client.egg.rate, 100);
	assert.equal(channel.sentPayloads[0], "Successfully changed a spawn rate to 100%!");

	await rateCommand.run(client, message, ["-7"]);
	assert.equal(client.egg.rate, 0);
	assert.equal(channel.sentPayloads[1], "Successfully changed a spawn rate to 0%!");
});

test("rate smoke: invalid values do not change state", async () => {
	process.env.BOT_OWNER_IDS = "owner-1";
	const channel = createChannel("chan-1");
	const rateCommand = loadModuleWithMocks(RATE_COMMAND_PATH, {});
	const client = {
		egg: {
			rate: 42,
		},
	};
	const message = {
		author: { id: "owner-1" },
		channel,
	};

	await rateCommand.run(client, message, ["not-a-number"]);

	assert.equal(client.egg.rate, 42);
	assert.equal(channel.sentPayloads.length, 0);
});

test("edit smoke: invalid amount exits safely without updates", async () => {
	process.env.BOT_OWNER_IDS = "owner-1";
	let updateCalls = 0;
	const channel = createChannel("chan-1");
	const editCommand = loadModuleWithMocks(EDIT_COMMAND_PATH, {
		[FUNCTIONS_MODULE_PATH]: {
			getUserFromArguments: async () => ({ id: "target-1", username: "target" }),
			getUserData: async () => ({ get: () => 10 }),
		},
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				update: async () => {
					updateCalls += 1;
				},
			},
		},
	});
	const client = {};
	const message = {
		author: { id: "owner-1" },
		channel,
	};

	await editCommand.run(client, message, ["target-1", "add", "oops"]);

	assert.equal(updateCalls, 0);
	assert.equal(channel.sentPayloads.length, 1);
	assert.equal(channel.sentPayloads[0], "add/minus amount");
});

test("spawn smoke: non-manager cannot spawn", async () => {
	process.env.BOT_OWNER_IDS = "owner-1";
	process.env.CHANNEL = "spawn-chan";
	const spawnChannel = createChannel("spawn-chan");
	const messageChannel = createChannel("msg-chan");
	let fetchChannelCalls = 0;
	let persistCalls = 0;
	const spawnCommand = loadModuleWithMocks(SPAWN_COMMAND_PATH, {
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});
	const client = {
		channels: {
			fetch: async () => {
				fetchChannelCalls += 1;
				return spawnChannel;
			},
		},
		egg: {
			id: "",
			followupId: "",
			isGolden: false,
		},
		persistEggRuntimeState: async () => {
			persistCalls += 1;
		},
	};
	const message = {
		author: { id: "user-2" },
		channel: messageChannel,
	};

	await spawnCommand.run(client, message);

	assert.equal(fetchChannelCalls, 0);
	assert.equal(persistCalls, 0);
	assert.equal(spawnChannel.sentPayloads.length, 0);
	assert.equal(messageChannel.sentPayloads.length, 0);
});

test("spawn smoke: admin can spawn and stale previous egg fetch is tolerated", async () => {
	process.env.BOT_OWNER_IDS = "";
	process.env.CHANNEL = "spawn-chan";
	process.env.PREFIX = ".";
	let persistCalls = 0;
	const spawnChannel = createChannel("spawn-chan");
	const messageChannel = createChannel("msg-chan");
	const spawnCommand = loadModuleWithMocks(SPAWN_COMMAND_PATH, {
		[EGG_MODULE_PATH]: {
			rollGoldenEgg: () => true,
			getEggMessage: () => "golden-egg-message",
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});
	const client = {
		channels: { fetch: async () => spawnChannel },
		egg: {
			id: "stale-egg-id",
			followupId: "stale-followup-id",
			isGolden: false,
		},
		persistEggRuntimeState: async () => {
			persistCalls += 1;
		},
	};
	const message = {
		author: { id: "admin-user-1" },
		member: {
			permissions: {
				has: () => true,
			},
		},
		channel: messageChannel,
	};

	await spawnCommand.run(client, message);

	assert.equal(client.egg.id, "m1");
	assert.equal(client.egg.followupId, "m2");
	assert.equal(client.egg.isGolden, true);
	assert.equal(persistCalls, 1);
	assert.equal(spawnChannel.sentPayloads.length, 2);
	assert.equal(spawnChannel.sentPayloads[0], "golden-egg-message");
	assert.match(spawnChannel.sentPayloads[1], /type `\.claim` to claim it!/);
	assert.equal(messageChannel.sentPayloads[0], "Successfully spawned an egg!");
});

test("spawn smoke: existing active egg is deleted before respawn", async () => {
	process.env.BOT_OWNER_IDS = "owner-1";
	process.env.CHANNEL = "spawn-chan";
	process.env.PREFIX = ".";
	let deleted = false;
	let persistCalls = 0;
	const spawnChannel = createChannel("spawn-chan");
	const messageChannel = createChannel("msg-chan");
	messageChannel.messageMap.set("egg-old-1", {
		delete: async () => {
			deleted = true;
		},
	});
	const spawnCommand = loadModuleWithMocks(SPAWN_COMMAND_PATH, {
		[EGG_MODULE_PATH]: {
			rollGoldenEgg: () => false,
			getEggMessage: () => "normal-egg-message",
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});
	const client = {
		channels: { fetch: async () => spawnChannel },
		egg: {
			id: "egg-old-1",
			followupId: "",
			isGolden: true,
		},
		persistEggRuntimeState: async () => {
			persistCalls += 1;
		},
	};
	const message = {
		author: { id: "owner-1" },
		channel: messageChannel,
	};

	await spawnCommand.run(client, message);

	assert.equal(deleted, true);
	assert.equal(client.egg.id, "m1");
	assert.equal(client.egg.followupId, "m2");
	assert.equal(client.egg.isGolden, false);
	assert.equal(persistCalls, 1);
});

test("auth smoke: owner IDs support commas and spaces", () => {
	process.env.BOT_OWNER_IDS = "owner-1, owner-2 owner-3";
	const { canManageBot, isBotOwner } = require(AUTH_UTIL_PATH);

	assert.equal(isBotOwner("owner-1"), true);
	assert.equal(isBotOwner("owner-2"), true);
	assert.equal(canManageBot({ author: { id: "owner-3" } }), true);
	assert.equal(canManageBot({ author: { id: "owner-4" } }), false);
});

test("auth smoke: guild administrator can manage without owner list", () => {
	process.env.BOT_OWNER_IDS = "";
	const { canManageBot, isGuildAdmin } = require(AUTH_UTIL_PATH);
	const member = {
		permissions: {
			has: () => true,
		},
	};

	assert.equal(isGuildAdmin(member), true);
	assert.equal(canManageBot({ author: { id: "user-1" }, member }), true);
});

test("runtime state smoke: load restores active egg and streak from persistence", async () => {
	const loadCalls = [];
	const persistedValues = {
		activeEggId: "persisted-egg-1",
		activeFollowupId: "persisted-followup-1",
		activeDropUserId: "drop-user-1",
		activeIsGolden: true,
		claimStreakUserId: "streak-user-1",
		claimStreakCount: 8,
	};
	const { loadEggRuntimeState } = loadModuleWithMocks(EGG_RUNTIME_STATE_UTIL_PATH, {
		[EGG_RUNTIME_STATE_SCHEMA_MODULE_PATH]: {
			EggRuntimeState: {
				findOrCreate: async (payload) => {
					loadCalls.push(payload);
					return [
						{
							get: (key) => persistedValues[key],
						},
					];
				},
			},
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});
	const client = {
		egg: {
			id: "",
			followupId: "",
			drop: "",
			isGolden: false,
			claimStreak: {
				userId: "",
				count: 0,
			},
		},
	};

	await loadEggRuntimeState(client);

	assert.equal(loadCalls.length, 1);
	assert.equal(client.egg.id, "persisted-egg-1");
	assert.equal(client.egg.followupId, "persisted-followup-1");
	assert.equal(client.egg.drop, "drop-user-1");
	assert.equal(client.egg.isGolden, true);
	assert.equal(client.egg.claimStreak.userId, "streak-user-1");
	assert.equal(client.egg.claimStreak.count, 8);
});

test("runtime state smoke: save sanitizes payload before persistence", async () => {
	let upsertPayload = null;
	const { saveEggRuntimeState } = loadModuleWithMocks(EGG_RUNTIME_STATE_UTIL_PATH, {
		[EGG_RUNTIME_STATE_SCHEMA_MODULE_PATH]: {
			EggRuntimeState: {
				upsert: async (payload) => {
					upsertPayload = payload;
				},
			},
		},
		[LOGGER_MODULE_PATH]: { info: () => {}, warn: () => {}, error: () => {} },
	});
	const client = {
		egg: {
			id: 123,
			followupId: "followup-1",
			drop: null,
			isGolden: "yes",
			claimStreak: {
				userId: 789,
				count: -3,
			},
		},
	};

	await saveEggRuntimeState(client);

	assert.deepEqual(upsertPayload, {
		id: 1,
		activeEggId: "",
		activeFollowupId: "followup-1",
		activeDropUserId: "",
		activeIsGolden: true,
		claimStreakUserId: "",
		claimStreakCount: 0,
	});
});

test("lb smoke: sends leaderboard embed with current user marker", async () => {
	process.env.PREFIX = ".";
	const channel = createChannel("chan-1");

	let findOneCallCount = 0;
	const lbCommand = loadModuleWithMocks(LB_COMMAND_PATH, {
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: {
				findAll: async () => [
					{ dataValues: { userid: "user-1", point: 5 } },
					{ dataValues: { userid: "user-2", point: 2 } },
				],
				findOne: async () => {
					findOneCallCount += 1;
					return null;
				},
			},
		},
	});

	const client = {
		users: {
			fetch: async (userId) => ({
				id: userId,
				toString: () => `<@${userId}>`,
			}),
		},
	};
	const message = {
		author: { id: "user-1", toString: () => "<@user-1>" },
		channel,
	};

	await lbCommand.run(client, message);

	assert.equal(findOneCallCount, 0);
	assert.equal(channel.sentPayloads.length, 1);
	assert.equal(Array.isArray(channel.sentPayloads[0].embeds), true);
	assert.equal(channel.sentPayloads[0].embeds.length, 1);
	assert.match(channel.sentPayloads[0].embeds[0].data.description, /---> \*\*\[1\]\*\* - <@user-1>/);
});

test("spawn rate smoke: activity lowers effective rate", () => {
	process.env.DYNAMIC_SPAWN_RATE = "true";
	process.env.DYNAMIC_RATE_TARGET_MESSAGES = "30";
	process.env.DYNAMIC_RATE_MIN_MULTIPLIER = "0.5";
	process.env.DYNAMIC_RATE_MAX_MULTIPLIER = "2";

	const effectiveRate = getEffectiveSpawnRate({
		baseRate: 6,
		activityCount: 120,
	});

	assert.equal(effectiveRate, 3);
});

test("spawn rate smoke: low activity raises effective rate", () => {
	process.env.DYNAMIC_SPAWN_RATE = "true";
	process.env.DYNAMIC_RATE_TARGET_MESSAGES = "30";
	process.env.DYNAMIC_RATE_MIN_MULTIPLIER = "0.5";
	process.env.DYNAMIC_RATE_MAX_MULTIPLIER = "2";

	const effectiveRate = getEffectiveSpawnRate({
		baseRate: 4,
		activityCount: 5,
	});

	assert.equal(effectiveRate, 8);
});
