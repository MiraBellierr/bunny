module.exports = {
	getUserData: async (Model, user) => {
		if (!(await Model.findOne({ where: { userid: user.id } }))) {
			await Model.create({
				userid: user.id,
			});
		}

		return await Model.findOne({ where: { userid: user.id } });
	},
};
