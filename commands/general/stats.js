const { EmbedBuilder } = require("discord.js");

const formatPercent = (value) => `${value.toFixed(2).replace(/\.?0+$/, "")}%`;

const toSafeCounter = (value) => {
	const parsed = Number.parseInt(value, 10);
	if (Number.isNaN(parsed) || parsed < 0) return 0;

	return parsed;
};

module.exports = {
	name: "stats",
	run: async (client, message) => {
		const stats = client?.egg?.stats || {};
		const trackedMessageCount = toSafeCounter(stats.trackedMessageCount);
		const spawnedEggCount = toSafeCounter(stats.spawnedEggCount);
		const spawnedGoldenEggCount = toSafeCounter(stats.spawnedGoldenEggCount);

		const eggPerMessagePercent =
			trackedMessageCount > 0 ? (spawnedEggCount / trackedMessageCount) * 100 : 0;
		const goldenPerMessagePercent =
			trackedMessageCount > 0 ? (spawnedGoldenEggCount / trackedMessageCount) * 100 : 0;
		const goldenPerEggPercent =
			spawnedEggCount > 0 ? (spawnedGoldenEggCount / spawnedEggCount) * 100 : 0;
		const embed = new EmbedBuilder()
			.setTitle("📊 Bunny Spawn Stats")
			.setDescription("Tracked from the configured spawn channel.")
			.setFields(
				{
					name: "💬 Messages Tracked",
					value: `${trackedMessageCount}`,
					inline: true,
				},
				{
					name: "🥚 Eggs Spawned",
					value: `${spawnedEggCount}`,
					inline: true,
				},
				{
					name: "📈 Spawn Percentage",
					value: `${formatPercent(eggPerMessagePercent)} (${spawnedEggCount}/${trackedMessageCount})`,
					inline: false,
				},
				{
					name: "✨ Golden Eggs Spawned",
					value: `${spawnedGoldenEggCount} (${formatPercent(goldenPerMessagePercent)} of messages, ${formatPercent(goldenPerEggPercent)} of eggs)`,
					inline: false,
				}
			);

		return message.channel.send({ embeds: [embed] });
	},
};
