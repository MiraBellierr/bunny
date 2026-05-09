const CLAIM_CHARACTER_ENTRIES = [
	"Aether",
	"Lumine",
	"Albedo",
	"Alhaitham",
	"Aloy",
	"Amber",
	"Arataki Itto",
	"Arlecchino",
	"Peruere",
	"Baizhu",
	"Barbara Pegg",
	"Beidou",
	"Bennett",
	"Candace",
	"Charlotte",
	"Chasca",
	"Chevreuse",
	"Chiori",
	"Chongyun",
	"Citlali",
	"Clorinde",
	"Collei",
	"Columbina",
	"Cyno",
	"Dahlia",
	"Dehya",
	"Diluc Ragnvindr",
	"Diona Katzlein",
	"Dori Sangemah Bay",
	"Durin",
	"Emilie",
	"Escoffier",
	"Eula Lawrence",
	"Faruzan",
	"Fischl von Luftschloss Narfidort",
	"Kyryll Chudomirovich Flins",
	"Freminet",
	"Furina de Fontaine",
	"Gaming",
	"Ganyu",
	"Gorou",
	"Hu Tao",
	"Iansan",
	"Ifa",
	"Illuga",
	"Ineffa",
	"Jahoda",
	"Jean Gunnhildr",
	"Kachina",
	"Kaedehara Kazuha",
	"Kaeya Alberich",
	"Kamisato Ayaka",
	"Kamisato Ayato",
	"Kaveh",
	"Keqing",
	"Kinich",
	"Kirara",
	"Klee",
	"Kujou Sara",
	"Kuki Shinobu",
	"Lan Yan",
	"Lauma",
	"Layla",
	"Linnea",
	"Lisa Minci",
	"Lynette",
	"Lyney",
	"Mavuika",
	"Mika Schmidt",
	"Mona Megistus",
	"Mualani",
	"Nahida",
	"Buer",
	"Navia Caspar",
	"Nefer",
	"Neuvillette",
	"Nilou",
	"Ningguang",
	"Noelle",
	"Ororon",
	"Qiqi",
	"Raiden Ei",
	"Beelzebul",
	"Razor",
	"Rosaria",
	"Sangonomiya Kokomi",
	"Sayu",
	"Sethos",
	"Shenhe",
	"Shikanoin Heizou",
	"Sigewinne",
	"Skirk",
	"Sucrose",
	"Tartaglia",
	"Ajax",
	"Thoma",
	"Tighnari",
	"Varesa",
	"Varka",
	"Venti",
	"Barbatos",
	"Wanderer",
	"Scaramouche",
	"Kunikuzushi",
	"Wonderland Manekin",
	"Wriothesley",
	"Xiangling",
	"Xianyun",
	"Cloud Retainer",
	"Xiao",
	"Alatus",
	"Xilonen",
	"Xingqiu",
	"Xinyan",
	"Yae Miko",
	"Yanfei",
	"Yaoyao",
	"Yelan",
	"Yoimiya Naganohara",
	"Yumemizuki Mizuki",
	"Yun Jin",
	"Zhongli",
	"Morax",
	"Rex Lapis",
	"Zibai",
];

const normalizeClaimColor = (value) => {
	if (typeof value !== "string") return "";

	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9]+/gi, " ")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ");
};

const CLAIM_CHARACTER_OPTIONS = CLAIM_CHARACTER_ENTRIES.map((entry) => {
	const aliases = entry.split("/").map((part) => part.trim()).filter(Boolean);
	const primaryName = aliases[0];
	const key = normalizeClaimColor(primaryName);
	const normalizedAliases = new Set(aliases.map(normalizeClaimColor).filter(Boolean));
	normalizedAliases.add(normalizeClaimColor(entry));

	return {
		entry,
		primaryName,
		key,
		aliases: [...normalizedAliases],
	};
});

const CLAIM_CHARACTER_BY_KEY = new Map(
	CLAIM_CHARACTER_OPTIONS.map((option) => [option.key, option])
);
const CLAIM_CHARACTER_ALIAS_TO_KEY = new Map();

for (const option of CLAIM_CHARACTER_OPTIONS) {
	for (const alias of option.aliases) {
		CLAIM_CHARACTER_ALIAS_TO_KEY.set(alias, option.key);
	}
}

const CLAIM_COLOR_OPTIONS = CLAIM_CHARACTER_OPTIONS.map((option) => option.key);

const resolveClaimColor = (value) =>
	CLAIM_CHARACTER_ALIAS_TO_KEY.get(normalizeClaimColor(value)) || "";

const isValidClaimColor = (value) => Boolean(resolveClaimColor(value));

const pickRandomClaimColor = () =>
	CLAIM_COLOR_OPTIONS[Math.floor(Math.random() * CLAIM_COLOR_OPTIONS.length)];

const getClaimCommand = (prefix = ".", claimColor = "") => {
	const resolvedClaimColor = resolveClaimColor(claimColor);
	const option = CLAIM_CHARACTER_BY_KEY.get(resolvedClaimColor);
	if (!option) return `\`${prefix}claim\``;

	return `\`${prefix}claim ${option.primaryName}\``;
};

const getClaimPromptText = (prefix = ".", claimColor = "") =>
	`type ${getClaimCommand(prefix, claimColor)} to claim it!`;

const getClaimGuidanceText = (prefix = ".", claimColor = "") =>
	`To claim this egg, type ${getClaimCommand(prefix, claimColor)}.`;

module.exports = {
	CLAIM_COLOR_OPTIONS,
	CLAIM_CHARACTER_OPTIONS,
	normalizeClaimColor,
	resolveClaimColor,
	isValidClaimColor,
	pickRandomClaimColor,
	getClaimCommand,
	getClaimPromptText,
	getClaimGuidanceText,
};
