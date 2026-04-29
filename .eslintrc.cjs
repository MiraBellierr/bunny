module.exports = {
	env: {
		node: true,
		es2021: true,
	},
	extends: ["eslint:recommended", "prettier"],
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "script",
	},
	ignorePatterns: ["node_modules/", "database.sqlite"],
	rules: {
		"no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
	},
};
