const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const Module = require("node:module");

const ROOT = path.resolve(__dirname, "..");
const CLAIM_COMMAND_PATH = path.join(ROOT, "commands/general/claim.js");
const DROP_COMMAND_PATH = path.join(ROOT, "commands/general/drop.js");
const LB_COMMAND_PATH = path.join(ROOT, "commands/general/lb.js");
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
		[EGG_SCHEMA_MODULE_PATH]: { Egg: () => model },
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
			Egg: () => ({
				increment: async () => {
					incrementCallCount += 1;
				},
			}),
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
			Egg: () => ({
				increment: async (...args) => {
					incrementCalls.push(args);
				},
			}),
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

test("drop smoke: rejects dropping when user has zero eggs", async () => {
	process.env.CHANNEL = "chan-1";
	process.env.GOLDEN_EGG_CHANCE = "0";
	const channel = createChannel("chan-1");
	let updateCallCount = 0;

	const dropCommand = loadModuleWithMocks(DROP_COMMAND_PATH, {
		[FUNCTIONS_MODULE_PATH]: {
			getUserData: async () => ({
				get: () => 0,
			}),
		},
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: () => ({
				update: () => {
					updateCallCount += 1;
				},
			}),
		},
	});

	const client = {
		channels: { fetch: async () => channel },
		egg: { id: "", followupId: "", drop: "" },
	};
	const message = {
		author: { id: "user-1" },
		member: "<@user-1>",
		channel,
	};

	await dropCommand.run(client, message);

	assert.equal(updateCallCount, 0);
	assert.deepEqual(channel.sentPayloads, ["You don't have any eggs :("]);
});

test("drop smoke: successful drop updates points and creates egg state", async () => {
	process.env.CHANNEL = "chan-1";
	process.env.PREFIX = ".";
	process.env.GOLDEN_EGG_CHANCE = "0";
	const channel = createChannel("chan-1");
	const updateCalls = [];

	const dropCommand = loadModuleWithMocks(DROP_COMMAND_PATH, {
		[FUNCTIONS_MODULE_PATH]: {
			getUserData: async () => ({
				get: () => 3,
			}),
		},
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: () => ({
				update: (...args) => {
					updateCalls.push(args);
				},
			}),
		},
	});

	const client = {
		channels: { fetch: async () => channel },
		egg: { id: "", followupId: "", drop: "" },
	};
	const message = {
		author: { id: "user-1" },
		member: "<@user-1>",
		channel,
	};

	await dropCommand.run(client, message);

	assert.equal(updateCalls.length, 1);
	assert.deepEqual(updateCalls[0][0], { point: 2 });
	assert.deepEqual(updateCalls[0][1], { where: { userid: "user-1" } });
	assert.equal(channel.sentPayloads.length, 3);
	assert.match(channel.sentPayloads[0], /dropped an egg/);
	assert.equal(channel.sentPayloads[1], "🥚");
	assert.match(channel.sentPayloads[2], /type `\.claim` to claim it!/);
	assert.equal(client.egg.id, "m2");
	assert.equal(client.egg.followupId, "m3");
	assert.equal(client.egg.drop, "user-1");
});

test("lb smoke: sends leaderboard embed with current user marker", async () => {
	process.env.PREFIX = ".";
	const channel = createChannel("chan-1");

	let findOneCallCount = 0;
	const lbCommand = loadModuleWithMocks(LB_COMMAND_PATH, {
		[EGG_SCHEMA_MODULE_PATH]: {
			Egg: () => ({
				findAll: async () => [
					{ dataValues: { userid: "user-1", point: 5 } },
					{ dataValues: { userid: "user-2", point: 2 } },
				],
				findOne: async () => {
					findOneCallCount += 1;
					return null;
				},
			}),
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
