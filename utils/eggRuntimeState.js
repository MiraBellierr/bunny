const { EggRuntimeState } = require("../database/schemas/eggRuntimeState");
const logger = require("./logger");

const RUNTIME_STATE_ID = 1;

const toSafeString = (value) => (typeof value === "string" ? value : "");

const toSafeStreakCount = (value) => {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 0) return 0;

	return parsed;
};

const buildStatePayload = (eggState = {}) => ({
	id: RUNTIME_STATE_ID,
	activeEggId: toSafeString(eggState.id),
	activeFollowupId: toSafeString(eggState.followupId),
	activeDropUserId: toSafeString(eggState.drop),
	activeIsGolden: Boolean(eggState.isGolden),
	claimStreakUserId: toSafeString(eggState.claimStreak?.userId),
	claimStreakCount: toSafeStreakCount(eggState.claimStreak?.count),
});

const applyStateToClient = (client, persistedState) => {
	client.egg.id = toSafeString(persistedState.get("activeEggId"));
	client.egg.followupId = toSafeString(persistedState.get("activeFollowupId"));
	client.egg.drop = toSafeString(persistedState.get("activeDropUserId"));
	client.egg.isGolden = Boolean(persistedState.get("activeIsGolden"));
	client.egg.claimStreak = {
		userId: toSafeString(persistedState.get("claimStreakUserId")),
		count: toSafeStreakCount(persistedState.get("claimStreakCount")),
	};
};

const saveEggRuntimeState = async (client) => {
	try {
		await EggRuntimeState.upsert(buildStatePayload(client.egg));
	} catch (error) {
		logger.error("Failed to persist egg runtime state", error);
	}
};

const loadEggRuntimeState = async (client) => {
	try {
		const [persistedState] = await EggRuntimeState.findOrCreate({
			where: { id: RUNTIME_STATE_ID },
			defaults: buildStatePayload(client.egg),
		});

		applyStateToClient(client, persistedState);
		logger.info(
			`Egg runtime state loaded | eggMessage=${client.egg.id || "none"} followup=${client.egg.followupId || "none"} streakUser=${client.egg.claimStreak.userId || "none"} streakCount=${client.egg.claimStreak.count}`
		);
	} catch (error) {
		logger.error("Failed to load egg runtime state", error);
	}
};

module.exports = {
	loadEggRuntimeState,
	saveEggRuntimeState,
};
