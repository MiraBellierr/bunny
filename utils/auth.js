const { PermissionsBitField } = require("discord.js");

const parseOwnerIds = (rawValue) =>
	String(rawValue || "")
		.split(/[,\s]+/g)
		.map((value) => value.trim())
		.filter(Boolean);

const isBotOwner = (userId) => {
	if (!userId) return false;

	const ownerIds = parseOwnerIds(process.env.BOT_OWNER_IDS);
	return ownerIds.includes(userId);
};

const isGuildAdmin = (member) =>
	Boolean(member?.permissions?.has?.(PermissionsBitField.Flags.Administrator));

const canManageBot = (message) => {
	if (!message?.author?.id) return false;

	return isBotOwner(message.author.id) || isGuildAdmin(message.member);
};

module.exports = {
	canManageBot,
	isBotOwner,
	isGuildAdmin,
};
