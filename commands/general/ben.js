const { canManageBot } = require("../../utils/auth");

module.exports = {
	name: "ben",
	run: async (_client, message, args = []) => {
		if (!canManageBot(message)) return;

		const target = String(args[0] || "").trim();
		if (!target) {
			return message.channel.send("Usage: ben <user> [reason]");
		}

		const reason = args.slice(1).join(" ").trim();
		const reasonText = reason ? reason : "No reason provided";
		const mentionBreak = String.fromCharCode(8203);
		const safeTarget = target.replace(/@/g, `@${mentionBreak}`);

		return message.channel.send(
			{
				content: `${safeTarget} has successfully been benned. Reason: ${reasonText}.`,
				allowedMentions: { parse: [] },
			}
		);
	},
};
