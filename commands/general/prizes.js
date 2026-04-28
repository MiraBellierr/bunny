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
			.setTitle("🏆 Dcolon Hunt Prize")
			.setDescription(
				`**🥇 Winner:** Mystery Gift!\n\n` +
				`**Prize Contents:**\n` +
				`• Blessing of the Welkin Moon (Genshin Impact)\n` +
				`• 284 Diamonds (Mobile Legends: Bang Bang)\n` +
				`• Express Supply Pass (Honkai: Star Rail)\n` +
				`• Inter-Knot Membership (Zenless Zone Zero)\n` +
				`• Monthly Pass (Arknights: Endfield)\n\n` +
				`The winner will be announced at the end of the <:DColon:881068692174159882> hunt event!`
			)
			.setColor("#FFD700");

		message.channel.send({ embeds: [embed] });
	},
};