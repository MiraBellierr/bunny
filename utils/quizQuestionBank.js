const QUESTION_BANK_ROWS = `
What is the longest that an elephant has ever lived? (That we know of)|86 years|17 years|49 years|142 years
How many rings are on the Olympic flag?|5|None|4|7
What is a tarsier?|A primate|A bird|A lizard|A fish
How did Spider-Man get his powers?|Bitten by a radioactive spider|Born with them|Military experiment gone awry|Woke up with them after a strange dream
In darts, what's the most points you can score with a single throw?|60|20|50|100
Which of these animals does NOT appear in the Chinese zodiac?|Bear|Dog|Dragon|Rabbit
Who are known as Brahmins?|Members of India's highest caste|Surfers in California|It's totally made up word|A type of pasta
How many holes are on a standard bowling ball?|3|2|5|10
Does coffee naturally contain caffeine - or is it added later?|Natural|Added later|It depends on the type of coffee|Only in instant coffee
What are the main colors on the flag of Spain?|Red and yellow|Black and yellow|Blue and white|Green and white
What is the name of this symbol: ¶|Pilcrow|Biltong|Fermata|Interrobang
In the nursery rhyme, how many blackbirds were baked in a pie?|24|4|11|99
What is a pomelo?|The largest citrus fruit|A breed of dog|An old-fashioned punching bag|A type of hat
Who killed Greedo?|Han Solo|Hannibal Lecter|Hermione Granger|Hercules
Are giant pandas a type of bear?|Yes|No|Only on Tuesdays|Only in the summer
How many points is the letter X worth in English-language Scrabble?|8|None|11|5
Are women required by law to wear headscarves in Iran?|Yes|No|Only in rural areas|Only during the month of Ramadan
`;

const GENERAL_KNOWLEDGE_QUESTION_BANK = QUESTION_BANK_ROWS.trim()
	.split("\n")
	.map((line) => line.trim())
	.filter(Boolean)
	.map((line) => {
		const parts = line.split("|").map((part) => part.trim());
		const [prompt, answer, wrong1, wrong2, wrong3] = parts;
		if (!prompt || !answer || !wrong1 || !wrong2 || !wrong3) {
			return null;
		}

		return {
			prompt,
			answer,
			wrongAnswers: [wrong1, wrong2, wrong3],
		};
	})
	.filter(Boolean);

module.exports = {
	GENERAL_KNOWLEDGE_QUESTION_BANK,
};
