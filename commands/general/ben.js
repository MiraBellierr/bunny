module.exports = {
	name: "ben",
	run: async (_client, message, args = []) => {
		const target = String(args[0] || "").trim();
		if (!target) {
			return message.channel.send("Usage: ben <user> [reason]");
		}

		const reason = args.slice(1).join(" ").trim();
		const reasonText = reason ? reason : "No reason provided";

		return message.channel.send(
			{
				content: `${target} has successfully been benned. Reason: ${reasonText}.`,
				allowedMentions: { parse: [] },
			}
		);
	},
};
