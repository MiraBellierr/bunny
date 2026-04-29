const DEFAULT_GOLDEN_EGG_CHANCE = 0.03;

const getGoldenEggChance = () => {
	const parsedChance = Number.parseFloat(process.env.GOLDEN_EGG_CHANCE || "");
	if (Number.isNaN(parsedChance)) return DEFAULT_GOLDEN_EGG_CHANCE;
	if (parsedChance < 0) return 0;
	if (parsedChance > 1) return 1;
	return parsedChance;
};

const rollGoldenEgg = () => Math.random() < getGoldenEggChance();

const getEggMessage = (isGolden) => (isGolden ? "🥚✨" : "🥚");

const rollClaimedEggs = (isGolden) =>
	isGolden ? Math.floor(Math.random() * 26) + 25 : Math.floor(Math.random() * 10) + 1;

module.exports = {
	rollGoldenEgg,
	getEggMessage,
	rollClaimedEggs,
};
