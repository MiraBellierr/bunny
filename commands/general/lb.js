/**
 *    Copyright 2022 MiraBellier

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
 */

const { Egg } = require("../../database/schemas/egg");
const { MessageEmbed } = require("discord.js");

module.exports = {
	name: "lb",
	category: "general",
	run: async (client, message) => {
		const findAllUser = await Egg().findAll({
			order: [["point", "DESC"]],
			limit: 10,
		});

		const leaderboard = [];

		await findAllUser.forEach(async (egg, index) => {
			const user = await client.users.fetch(egg.dataValues.userid);

			leaderboard.push(
				`**[${index + 1}]** - ${user.toString()}: \`${
					egg.dataValues.point
				}\` eggs`
			);
		});

		const embed = new MessageEmbed().setDescription(leaderboard.join("\n"));

		message.channel.send({ embeds: [embed] });
	},
};
