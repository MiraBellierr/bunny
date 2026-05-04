const { isBotOwner } = require("../../utils/auth");
const { getGoldenEggChance } = require("../../utils/egg");
const { getClaimStreakTierSize } = require("../../utils/claimQuiz");

const formatPercent = (value) => `${(value * 100).toFixed(2).replace(/\.?0+$/, "")}%`;

module.exports = {
	name: "config",
	run: async (client, message, args) => {
		if (!isBotOwner(message?.author?.id)) return;

		const subcommand = (args[0] || "").toLowerCase();

		if (!subcommand) {
			return message.channel.send(
				`Golden egg chance: ${getGoldenEggChance()} (${formatPercent(
					getGoldenEggChance()
				)}) | Claim streak tier size: ${getClaimStreakTierSize()}`
			);
		}

		if (subcommand === "golden") {
			const parsedChance = Number.parseFloat(args[1] || "");
			if (Number.isNaN(parsedChance)) {
				return message.channel.send("Usage: config golden <0-1>");
			}

			const clampedChance = Math.min(1, Math.max(0, parsedChance));
			process.env.GOLDEN_EGG_CHANCE = String(clampedChance);

			return message.channel.send(
				`Successfully changed golden egg chance to ${clampedChance} (${formatPercent(
					clampedChance
				)}).`
			);
		}

		if (subcommand === "streak") {
			const parsedTierSize = Number.parseInt(args[1] || "", 10);
			if (Number.isNaN(parsedTierSize)) {
				return message.channel.send("Usage: config streak <number>");
			}

			const normalizedTierSize = Math.max(1, parsedTierSize);
			process.env.CLAIM_STREAK_TIER_SIZE = String(normalizedTierSize);

			return message.channel.send(
				`Successfully changed claim streak tier size to ${normalizedTierSize}.`
			);
		}

		return message.channel.send("Usage: config <golden|streak> <value>");
	},
};
