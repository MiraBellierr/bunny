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

const clampRate = (value) => Math.min(100, Math.max(0, value));

const getSpawnRate = (client) => {
	const explicitBaseRate = Number.parseFloat(client?.egg?.baseRate);
	if (Number.isFinite(explicitBaseRate)) {
		return clampRate(explicitBaseRate);
	}

	const legacyRate = Number.parseFloat(client?.egg?.rate);
	if (Number.isFinite(legacyRate)) {
		return clampRate(legacyRate);
	}

	return 0;
};

module.exports = {
	name: "rate",
	run: async (client, message, args) => {
		if (!canManageBot(message)) return;

		if (!args[0]) {
			return message.channel.send(`The spawn rate: ${getSpawnRate(client)}%`);
		}

		const parsedRate = Number.parseFloat(args[0]);
		if (!Number.isFinite(parsedRate)) return;

		const clampedRate = clampRate(parsedRate);
		client.egg.baseRate = clampedRate;
		client.egg.rate = clampedRate;

		message.channel.send(`Successfully changed a spawn rate to ${clampedRate}%!`);
	},
};
