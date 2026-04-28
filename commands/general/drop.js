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

const functions = require("../../utils/functions");
const { Egg } = require("../../database/schemas/egg");

module.exports = {
  name: "drop",
  category: "general",
  run: async (client, message) => {
    const channel = await client.channels.fetch(process.env.CHANNEL);

    if (message.channel.id !== channel.id) return;

    if (client.egg.id)
      return message.channel.send(
        "There is still an egg in the channel! Claim it fast!!",
      );

    const eggData = await functions.getUserData(Egg(), message.author);
    const point = eggData.get("point");

    if (point < 1) return message.channel.send("You don't have any eggs :(");

    Egg().update(
      { point: point - 1 },
      { where: { userid: message.author.id } },
    );

    message.channel.send(`${message.member} dropped an egg! \`-1\``);

    const eggMessage = await message.channel.send("<:DColon:881068692174159882>");
    const msg2 = await channel.send(
      `-# type \`${process.env.PREFIX}claim\` to claim it! Person who gets the most <:DColon:881068692174159882> will get a mystery gift!`,
    );

    client.egg.id = eggMessage.id;
    client.egg.drop = message.author.id;
    client.egg.followupId = msg2.id;
  },
};
