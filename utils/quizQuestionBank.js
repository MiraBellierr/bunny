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
What is taxidermy?|The art of stuffing animal remains for display|Another word for tax evasion|Classification of species into categories| The artistic trimming of hedges
Where would you be most likely to see an epitaph?|On a tombstone|At the bottom of a page|At a zoo|On a boat
What famous book did Marie Kondo write?|The Life-Changing Magic of Tidying Up|The Amazing Art of Going to the Bathroom|Eating Cheese: Why You Should Never Do It|The Simple Act of Making Breakfast
What is the title of the rock song that starts "Jeremiah was a bullfrog"?|Joy to the World|I Can't Go For That (No Can Do)|Sympathy for the Devil|Whole Lotta Love
Are there any fish that have teeth?|Yes|No|Only in the ocean|Only in freshwater
Who is Jamie Oliver?|A celebrity chef|A former member of the boy band "One Direction"|A Shakespearean actor|An underwear model
What is Times New Roman?|A font|A mathematical function|A newspaper|A religious movement
Which of the following is a portmanteau?|Brunch|A man, a plan, a canal. Panama!|Jumbo shrimp|Flamingo dancing
Which of these islands is furthest south?|Trinidad|Cuba|Jamaica|Hispaniola
Which of these is furthest from the sun?|Saturn|Asteroid belt|Earth|Mercury
Which of these words is spelled incorrectly?|Cemetary|Mayhem|Prerogative|Epitome
Does a piano have more white keys or black keys?|White keys|Black keys|The same number|Neither, it depends on the type of piano
Where would you find the Spanish Steps?|Rome|Madrid|Mars|New York City
Which of the following is NOT a type of cheese?|Kalamata|Gouda|Havarti|Roquefort
Which of these colors is closest to chartreuse?|Yellow green|Gray|Pink|Orange
What was the first planet discovered with the use of a telescope?|Uranus|Jupiter|Pluto|Saturn
What letter is a protractor shaped like?|D|F|L|V
In the Bible, what were the Ten Commandments first written on?|Two tablets of stone|Birth bark|Parchment made of sheep skin|A wax cylinder
How long does it take light to travel from the Sun to the Earth?|About 8 minutes|It's instantaneous|About 11 days|2 or 3 months, depending on the time of year
Is the U.S. Congress unicameral or bicameral?|Bicameral|Unicameral|Tricameral|Quadcameral
Is it really true that some Amazonian rainforest tribes would collect the shrunken heads of their enemies?|Yes, it's true|No, it's a myth|Only in the movies|Only in video games
When did Mahatma Gandhi die?|1948|1961|1975|1997
Has Toronto ever hosted the Olympics?|No|Yes, in 1976|Yes, in 1988|Yes, in 2010
Which of these noble ranks is highest?|Duke|Baron|Earl|Marquis
The U.S. state of New Jersey is named after Jersey. But what is Jersey?|A British island off the coast of France|A Dutch province|A Native American tribe|There are multiple theories - no one is sure
Does Mars have any moons?|Yes|No|Only during certain times of the year|Only in the southern hemisphere
A triangle has one side with a length of 3 and another side with a length of 4. What is the length of the third side?|Impossible to say|4|5|6
Who is Paul Simon?|A singer-songwrite|A famous lawyer|A playwright|A serial killer
Which of these is NOT caused by a virus?|Cholera|Herpes|Measles|Smallpox
What do Alvin the Chipmunk and Hester Prynne have in common?|They both have the letter "A" on their clothes|They both have very high voices|They were both born in Sweden|They were both created by Nathaniel Hawthorne
Which of the following is a synonym of "benighted"?|Ignorant|Noble|Old|Smitten
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
