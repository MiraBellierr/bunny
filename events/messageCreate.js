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

const { PermissionsBitField } = require("discord.js");
const logger = require("../utils/logger");
const { rollGoldenEgg, getEggMessage } = require("../utils/egg");
const { pickRandomClaimColor, getClaimPromptText } = require("../utils/claimPassphrase");
let before = "";
const SPAWN_COOLDOWN_MS = 10 * 1000;

module.exports = async (client, message) => {
	if (!message.guild) return;
	if (message.author.bot) return;

	if (
		!message.guild.members.me.permissions.has(PermissionsBitField.Flags.SendMessages) ||
		!message.guild.members.me
			.permissionsIn(message.channel)
			.has(PermissionsBitField.Flags.SendMessages)
	)
		return;

	const prefix = process.env.PREFIX;

	if (message.content.startsWith(prefix)) {
		if (!message.member) message.member = await message.guild.members.fetch(message.author.id);
		if (
			!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ReadMessageHistory) ||
			!message.guild.members.me
				.permissionsIn(message.channel)
				.has(PermissionsBitField.Flags.ReadMessageHistory)
		)
			return message.channel.send(
				"I need a read message history permission for me to be able to reply to the past messages."
			);

		const args = message.content.slice(prefix.length).trim().split(/ +/g);
		const cmd = args.shift().toLowerCase();

		if (cmd.length === 0) return;

		let command = client.commands.get(cmd);
		if (!command) command = client.commands.get(client.aliases.get(cmd));

		try {
			if (command) {
				await command.run(client, message, args);
			}
		} catch (error) {
			console.error(error);
			message.reply(`there was an error trying to execute that command! \n\`${error}\``);
		}
	}

	if (message.channel.id === process.env.CHANNEL) {
		if (!client.egg.stats) {
			client.egg.stats = {
				trackedMessageCount: 0,
				spawnedEggCount: 0,
				spawnedGoldenEggCount: 0,
			};
		}
		client.egg.stats.trackedMessageCount += 1;
		if (client.egg.stats.trackedMessageCount % 25 === 0) {
			void client.persistEggRuntimeState?.();
		}

		const baseRate = Number.isFinite(client.egg.baseRate)
			? Math.min(100, Math.max(0, client.egg.baseRate))
			: Math.min(100, Math.max(0, Number(client.egg.rate) || 0));

		if (
			!Number.isFinite(client.cooldown) ||
			Date.now() - client.cooldown >= SPAWN_COOLDOWN_MS
		) {
			const channel = await client.channels.fetch(process.env.CHANNEL);
			const random = Math.random() * 100;
			logger.info(`Egg roll check | random=${random} baseRate=${baseRate}`);

				if (before !== message.author.id && random < baseRate) {
					if (client.egg.pendingQuiz && Date.now() <= client.egg.pendingQuiz.expiresAt) {
						logger.info(
							`Egg spawn skipped | reason=active_claim_quiz quizMessage=${client.egg.pendingQuiz.quizMessageId || "none"}`
						);
						return;
					}

				let previousEgg = null;
				if (client.egg.id) {
					previousEgg = await message.channel.messages
						.fetch(client.egg.id)
						.catch(() => null);
				}

					if (previousEgg) {
						if (typeof previousEgg.delete === "function") {
							try {
								await previousEgg.delete();
							} catch {
								// ignore previous egg deletion errors
							}
						}
					}

					const isGolden = rollGoldenEgg();
					const claimColor = pickRandomClaimColor();
					const msg = await channel.send(getEggMessage(isGolden));
					const msg2 = await channel.send(
						`-# ${getClaimPromptText(process.env.PREFIX, claimColor)} Person below is cute.`
					);

					if (client.egg.pendingQuiz && Date.now() <= client.egg.pendingQuiz.expiresAt) {
						if (typeof msg.delete === "function") {
							try {
								await msg.delete();
							} catch {
								// ignore spawn message deletion errors
							}
						}
						if (typeof msg2.delete === "function") {
							try {
								await msg2.delete();
							} catch {
								// ignore spawn follow-up deletion errors
							}
						}
						logger.info(
							`Egg spawn discarded | reason=active_claim_quiz quizMessage=${client.egg.pendingQuiz.quizMessageId || "none"}`
						);
						return;
					}

				before = message.author.id;
				client.cooldown = Date.now();
				client.egg.drop = "";
				client.egg.followupId = msg2.id;
				client.egg.id = msg.id;
				client.egg.isGolden = isGolden;
				client.egg.claimColor = claimColor;
				client.egg.stats.spawnedEggCount += 1;
				if (isGolden) {
					client.egg.stats.spawnedGoldenEggCount += 1;
				}
				await client.persistEggRuntimeState?.();
				logger.info(
					`Egg spawned | channel=${channel.id} eggMessage=${msg.id} golden=${isGolden}`
				);
			}
		}
	}
};
