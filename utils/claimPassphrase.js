const CLAIM_COLOR_OPTIONS = [
	"lightsalmon", "salmon", "darksalmon", "lightcoral", "indianred", "crimson", "firebrick", "red", "darkred", // red
	"coral", "tomato", "orangered", "gold", "orange", "darkorange", // orange
	"lightyellow", "lemonchiffon", "lightgoldenrodyellow", "papayawhip", "moccasin", "peachpuff", "	palegoldenrod", "khaki", "darkkhaki", "yellow", // yellow
	"lawngreen", "chartreuse", "limegreen", "lime", "forestgreen", "green", "darkgreen", "greenyellow", "yellowgreen", "springgreen", "mediumspringgreen", "lightgreen", "palegreen", "darkseagreen", "mediumseagreen", "seagreen", "olive", "darkolivegreen", "olivedrab", // green
	"lightcyan", "cyan", "aqua", "aquamarine", "mediumaquamarine", "paleturquoise", "turquoise", "mediumturquoise", "darkturquoise", "	lightseagreen", "cadetblue", "darkcyan", "teal", // cyan
	"powderblue", "lightblue", "lightskyblue", "skyblue", "deepskyblue", "lightsteelblue", "dodgerblue", "cornflowerblue", "steelblue", "royalblue", "blue", "mediumblue", "darkblue", "navy", "midnightblue", "mediumslateblue", "slateblue", "darkslateblue", // blue
	"lavender", "thistle", "plum", "violet", "orchid", "fuchsia", "magenta", "mediumorchid", "mediumpurple", "blueviolet", "darkviolet", "darkorchid", "darkmagenta", "purple", "indigo", // purple
	"pink", "lightpink", "hotpink", "deeppink", "palevioletred", "mediumvioletred", // pink
	"white", "snow", "honeydew", "mintcream", "azure", "aliceblue", "ghostwhite", "whitesmoke", "seashell", "beige", "oldlace", "floralwhite", "ivory", "antiquewhite", "linen", "lavendarblush", "mistyrose", // white
	"gainsboro", "lightgray", "silver", "darkgray", "gray", "dimgray", "lightslategray", "slategray", "darkslategray", "black", // gray
	"cornsilk", "blanchedalmond", "bisque", "navajowhite", "wheat", "burlywood", "tan", "rosybrown", "sandybrown", "goldenrod", "peru", "chocolate", "saddlebrown", "sienna", "brown", "maroon" // brown
];

const normalizeClaimColor = (value) => {
	if (typeof value !== "string") return "";
	return value.trim().toLowerCase();
};

const isValidClaimColor = (value) => CLAIM_COLOR_OPTIONS.includes(normalizeClaimColor(value));

const pickRandomClaimColor = () =>
	CLAIM_COLOR_OPTIONS[Math.floor(Math.random() * CLAIM_COLOR_OPTIONS.length)];

const getClaimCommand = (prefix = ".", claimColor = "") =>
	`\`${prefix}claim ${normalizeClaimColor(claimColor)}\``;

const getClaimPromptText = (prefix = ".", claimColor = "") =>
	`type ${getClaimCommand(prefix, claimColor)} to claim it!`;

const getClaimGuidanceText = (prefix = ".", claimColor = "") =>
	`To claim this egg, type ${getClaimCommand(prefix, claimColor)}.`;

module.exports = {
	CLAIM_COLOR_OPTIONS,
	normalizeClaimColor,
	isValidClaimColor,
	pickRandomClaimColor,
	getClaimCommand,
	getClaimPromptText,
	getClaimGuidanceText,
};
