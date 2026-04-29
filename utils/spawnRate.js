const DEFAULT_WINDOW_SECONDS = 300;
const DEFAULT_TARGET_MESSAGES = 30;
const DEFAULT_MIN_MULTIPLIER = 0.5;
const DEFAULT_MAX_MULTIPLIER = 2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const getEnvNumber = (envName, fallback) => {
	const parsedValue = Number.parseFloat(process.env[envName] || "");
	if (Number.isNaN(parsedValue)) return fallback;
	return parsedValue;
};

const isDynamicSpawnRateEnabled = () =>
	(process.env.DYNAMIC_SPAWN_RATE || "true").toLowerCase() !== "false";

const getActivityWindowMs = () => {
	const seconds = getEnvNumber("DYNAMIC_RATE_WINDOW_SECONDS", DEFAULT_WINDOW_SECONDS);
	return Math.max(1, seconds) * 1000;
};

const getEffectiveSpawnRate = ({ baseRate, activityCount }) => {
	const normalizedBaseRate = clamp(Math.round(Number(baseRate) || 0), 0, 100);
	if (!isDynamicSpawnRateEnabled()) return normalizedBaseRate;

	const targetMessages = Math.max(
		1,
		getEnvNumber("DYNAMIC_RATE_TARGET_MESSAGES", DEFAULT_TARGET_MESSAGES)
	);
	const minMultiplier = Math.max(
		0,
		getEnvNumber("DYNAMIC_RATE_MIN_MULTIPLIER", DEFAULT_MIN_MULTIPLIER)
	);
	const maxMultiplier = Math.max(
		minMultiplier,
		getEnvNumber("DYNAMIC_RATE_MAX_MULTIPLIER", DEFAULT_MAX_MULTIPLIER)
	);

	const safeActivityCount = Math.max(1, activityCount);
	const multiplier = clamp(targetMessages / safeActivityCount, minMultiplier, maxMultiplier);

	return clamp(Math.round(normalizedBaseRate * multiplier), 0, 100);
};

module.exports = {
	getActivityWindowMs,
	getEffectiveSpawnRate,
	isDynamicSpawnRateEnabled,
};
