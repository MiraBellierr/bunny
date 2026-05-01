const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

const ROOT = path.resolve(__dirname, "..");
const CLAIM_COMMAND_PATH = path.join(ROOT, "commands/general/claim.js");
const LB_COMMAND_PATH = path.join(ROOT, "commands/general/lb.js");
const RATE_COMMAND_PATH = path.join(ROOT, "commands/general/rate.js");
const RESET_COMMAND_PATH = path.join(ROOT, "commands/general/reset.js");
const { getEffectiveSpawnRate } = require("../utils/spawnRate");

const FUNCTIONS_MODULE_PATH = require.resolve(path.join(ROOT, "utils/functions.js"));
const EGG_SCHEMA_MODULE_PATH = require.resolve(path.join(ROOT, "database/schemas/egg.js"));
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
