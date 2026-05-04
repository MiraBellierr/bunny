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
const { getUserFromArguments, getUserData } = require("../../utils/functions");
const { isBotOwner } = require("../../utils/auth");

module.exports = {
	name: "edit",
	run: async (client, message, args) => {
		if (!isBotOwner(message?.author?.id)) return;

		if (!args[0] || !args[0].length) return;

		const target = await getUserFromArguments(message, args[0]);
		if (!target) return message.channel.send("User not found.");

		const targetEggs = await getUserData(Egg, target);

		const eggPoint = targetEggs.get("point");

		if (!args[2] || isNaN(args[2])) return message.channel.send("add/minus amount");

		const amount = parseInt(args[2]);

		if (args[1] === "add") {
			Egg.update({ point: eggPoint + amount }, { where: { userid: target.id } });
		} else if (args[1] === "minus") {
			Egg.update({ point: eggPoint - amount }, { where: { userid: target.id } });
		}

		message.channel.send(`Successfully ${args[1]} ${amount} eggs to ${target.username}.`);
	},
};
