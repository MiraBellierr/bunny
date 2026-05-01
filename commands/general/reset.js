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
const BOT_OWNER_ID = "548050617889980426";
const RESET_CONFIRM_WINDOW_MS = 30 * 1000;

module.exports = {
	name: "reset",
	category: "general",
	run: async (client, message, args = []) => {
		if (message.author.id !== BOT_OWNER_ID) return;

		const now = Date.now();
		const confirmArg = String(args[0] || "").toLowerCase();
		const hasValidPendingConfirmation =
			client.resetConfirmation &&
			client.resetConfirmation.requesterId === message.author.id &&
			client.resetConfirmation.expiresAt > now;
		const prefix = process.env.PREFIX || ".";

		if (confirmArg !== "confirm") {
			client.resetConfirmation = {
				requesterId: message.author.id,
				expiresAt: now + RESET_CONFIRM_WINDOW_MS,
			};

			return message.channel.send(
				`This will permanently reset the egg database. Run \`${prefix}reset confirm\` within 30 seconds to continue.`
			);
		}

		if (!hasValidPendingConfirmation) {
			return message.channel.send(
				`No pending reset request found. Run \`${prefix}reset\` first.`
			);
		}

		client.resetConfirmation = null;
		await Egg.truncate();
		if (client.egg) {
			client.egg.id = "";
			client.egg.followupId = "";
			client.egg.drop = "";
			client.egg.isGolden = false;
			client.egg.claimStreak = {
				userId: "",
				count: 0,
			};
			await client.persistEggRuntimeState?.();
		}

		message.channel.send("Database reset");
	},
};
