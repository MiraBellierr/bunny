const { EggRuntimeState } = require("../database/schemas/eggRuntimeState");
const Sequelize = require("sequelize");
const logger = require("./logger");

const RUNTIME_STATE_ID = 1;
const RUNTIME_STATS_COLUMNS = [
	{
		name: "trackedMessageCount",
		definition: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	},
	{
		name: "spawnedEggCount",
		definition: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	},
	{
		name: "spawnedGoldenEggCount",
		definition: {
			type: Sequelize.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	},
];
let runtimeStateSchemaReadyPromise = null;

const toSafeString = (value) => (typeof value === "string" ? value : "");

const toSafeStreakCount = (value) => {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 0) return 0;

	return parsed;
};

const toSafeCounter = (value) => {
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
	trackedMessageCount: toSafeCounter(eggState.stats?.trackedMessageCount),
	spawnedEggCount: toSafeCounter(eggState.stats?.spawnedEggCount),
	spawnedGoldenEggCount: toSafeCounter(eggState.stats?.spawnedGoldenEggCount),
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
	client.egg.stats = {
		trackedMessageCount: toSafeCounter(persistedState.get("trackedMessageCount")),
		spawnedEggCount: toSafeCounter(persistedState.get("spawnedEggCount")),
		spawnedGoldenEggCount: toSafeCounter(persistedState.get("spawnedGoldenEggCount")),
	};
};

const ensureEggRuntimeStateSchema = async () => {
	if (runtimeStateSchemaReadyPromise) {
		return runtimeStateSchemaReadyPromise;
	}

	runtimeStateSchemaReadyPromise = (async () => {
		if (
			!EggRuntimeState?.sequelize?.getQueryInterface ||
			typeof EggRuntimeState.getTableName !== "function"
		) {
			return;
		}

		const tableName = EggRuntimeState.getTableName();
		const queryInterface = EggRuntimeState.sequelize.getQueryInterface();
		const tableDefinition = await queryInterface.describeTable(tableName);

		for (const column of RUNTIME_STATS_COLUMNS) {
			if (Object.prototype.hasOwnProperty.call(tableDefinition, column.name)) continue;

			await queryInterface.addColumn(tableName, column.name, column.definition);
			logger.info(`Egg runtime state schema updated | added column=${column.name}`);
		}
	})();

	try {
		await runtimeStateSchemaReadyPromise;
	} catch (error) {
		runtimeStateSchemaReadyPromise = null;
		throw error;
	}
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
		await ensureEggRuntimeStateSchema();
		const [persistedState] = await EggRuntimeState.findOrCreate({
			where: { id: RUNTIME_STATE_ID },
			defaults: buildStatePayload(client.egg),
		});

		applyStateToClient(client, persistedState);
		logger.info(
			`Egg runtime state loaded | eggMessage=${client.egg.id || "none"} followup=${client.egg.followupId || "none"} streakUser=${client.egg.claimStreak.userId || "none"} streakCount=${client.egg.claimStreak.count} messages=${client.egg.stats.trackedMessageCount} spawned=${client.egg.stats.spawnedEggCount} goldenSpawned=${client.egg.stats.spawnedGoldenEggCount}`
		);
	} catch (error) {
		logger.error("Failed to load egg runtime state", error);
	}
};

module.exports = {
	loadEggRuntimeState,
	saveEggRuntimeState,
};
