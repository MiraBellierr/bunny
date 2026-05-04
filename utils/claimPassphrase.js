const CLAIM_COLOR_OPTIONS = ["indigo", "magenta", "seagrass"];

const normalizeClaimColor = (value) => {
	if (typeof value !== "string") return "";
	return value.trim().toLowerCase();
};

const isValidClaimColor = (value) => CLAIM_COLOR_OPTIONS.includes(normalizeClaimColor(value));

const pickRandomClaimColor = () =>
	CLAIM_COLOR_OPTIONS[Math.floor(Math.random() * CLAIM_COLOR_OPTIONS.length)];

const getClaimCommand = (prefix = ".", claimColor = "") =>
	`\`${prefix}claim ${normalizeClaimColor(claimColor)}\``;

const getClaimPromptText = (prefix = ".", claimColor = "") =>
	`type ${getClaimCommand(prefix, claimColor)} to claim it!`;

const getClaimGuidanceText = (prefix = ".", claimColor = "") =>
	`To claim this egg, type ${getClaimCommand(prefix, claimColor)}.`;

module.exports = {
	CLAIM_COLOR_OPTIONS,
	normalizeClaimColor,
	isValidClaimColor,
	pickRandomClaimColor,
	getClaimCommand,
	getClaimPromptText,
	getClaimGuidanceText,
};
