const format = (level, message) => `[${new Date().toISOString()}] [${level}] ${message}`;

module.exports = {
	info: (message) => {
		console.log(format("INFO", message));
	},
	warn: (message) => {
		console.warn(format("WARN", message));
	},
	error: (message, error) => {
		if (error) {
			console.error(format("ERROR", message), error);
			return;
		}

		console.error(format("ERROR", message));
	},
};
