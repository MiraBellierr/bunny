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

const { canManageBot } = require("../../utils/auth");

module.exports = {
	name: "rate",
	run: async (client, message, args) => {
		if (!canManageBot(message)) return;

		if (!args[0]) {
			message.channel.send(`The spawn rate: ${client.egg.rate}%`);
		}

		const rate = args[0];

		if (isNaN(rate)) return;

		client.egg.rate = parseInt(rate);

		message.channel.send(`Successfully changed a spawn rate to ${rate}%!`);
	},
};
