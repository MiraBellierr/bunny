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

const { EmbedBuilder } = require("discord.js");

module.exports = {
	name: "prizes",
	category: "general",
	run: async (client, message) => {
		const embed = new EmbedBuilder()
			.setTitle("🏆 Egg Hunt Prize")
			.setDescription(
				`**🥇 Winner:** Mystery Gift!\n\n` +
					`**Prize Contents:**\n` +
					`• Blessing of the Welkin Moon OR 330 Genesis Crystals OR 300 Chronal Nexus (Genshin Impact)\n` +
					`• 284 Diamonds (Mobile Legends: Bang Bang)\n` +
					`• Express Supply Pass OR 330 Oneiric Shard (Honkai: Star Rail)\n` +
					`• Inter-Knot Membership (Zenless Zone Zero)\n` +
					`• $10 USD Steam Gift Card\n` +
					`• $10 Discord Nitro\n` +
					`• Discord Profile Decoration\n` +
					`• $10 Razer Gold Gift Card\n\n` +
					`The winner will be announced at the end of the egg hunt event!`
			)
			.setColor("#FFD700");

		message.channel.send({ embeds: [embed] });
	},
};
