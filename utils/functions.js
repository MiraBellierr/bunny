module.exports = {
	getUserData: async (Model, user) => {
		const [userData] = await Model.findOrCreate({
			where: { userid: user.id },
			defaults: {
				userid: user.id,
			},
		});

		return userData;
	},

	getMemberFromArguments: async (message, argument) => {
		if (!argument) {
			return null;
		}

		const memberToFind = argument.toLowerCase();

		if (message.mentions.members.first()) {
			return message.mentions.members.first();
		}

		if (!Number.isNaN(Number(memberToFind))) {
			const fetched = await message.guild.members.fetch(memberToFind).catch(() => null);

			if (fetched) {
				return fetched;
			}
		}

		return message.guild.members.cache.find(
			(target) =>
				target.displayName.toLowerCase().includes(memberToFind) ||
				target.user.tag.toLowerCase().includes(memberToFind)
		);
	},

	getUserFromArguments: async (message, argument) => {
		if (!argument) {
			return null;
		}

		const userToFind = argument.toLowerCase();

		if (message.mentions.users.first()) {
			return message.mentions.users.first();
		}

		if (!Number.isNaN(Number(userToFind))) {
			const fetched = await message.client.users.fetch(userToFind).catch(() => null);

			if (fetched) {
				return fetched;
			}
		}

		return message.client.users.cache.find(
			(target) =>
				target.username.toLowerCase().includes(userToFind) ||
				target.tag.toLowerCase().includes(userToFind)
		);
	},
};
