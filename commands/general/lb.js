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
const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "lb",
	category: "general",
	run: async (client, message) => {
		const findAllUser = await Egg.findAll({
			order: [["point", "DESC"]],
		});

		if (!findAllUser.length) return message.channel.send("No Data Yet!");

		const top10Users = findAllUser.slice(0, 10);

		const leaderboard = [];
		let userIndex = -1;

		for (const [index, egg] of top10Users.entries()) {
			const user = await client.users.fetch(egg.dataValues.userid).catch(() => null);
			const userLabel = user ? user.toString() : `<@${egg.dataValues.userid}>`;
			const isCurrentUser = egg.dataValues.userid === message.author.id;

			if (!isCurrentUser) {
				leaderboard.push(`**[${index + 1}]** - ${userLabel}: \`${egg.dataValues.point}\` eggs`);
			} else {
				userIndex = index;

				leaderboard.push(
					`---> **[${index + 1}]** - ${userLabel}: \`${egg.dataValues.point}\` eggs`
				);
			}
		}

		if (userIndex === -1) {
			const userEgg = await Egg.findOne({
				where: {
					userid: message.author.id,
				},
			});

			if (userEgg) {
				for (let i = 0; i < findAllUser.length; i++) {
					if (findAllUser[i].dataValues.userid === message.author.id) {
						userIndex = i;
						break;
					}
				}

				leaderboard.push(
					`--> **[${userIndex + 1}]** - ${message.author}: \`${userEgg.get("point")}\` eggs`
				);
			}
		}

		const embed = new EmbedBuilder().setDescription(leaderboard.join("\n")).setFooter({
			text: `The winner will get a mystery gift! ${process.env.PREFIX}prizes to see the prizes!`,
		});

		message.channel.send({ embeds: [embed] });
	},
};
