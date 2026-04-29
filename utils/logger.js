const pad = (value, length = 2) => String(value).padStart(length, "0");

const getLocalTimestamp = () => {
	const date = new Date();
	const offsetMinutes = -date.getTimezoneOffset();
	const offsetSign = offsetMinutes >= 0 ? "+" : "-";
	const absoluteOffsetMinutes = Math.abs(offsetMinutes);
	const offsetHours = pad(Math.floor(absoluteOffsetMinutes / 60));
	const offsetRemainingMinutes = pad(absoluteOffsetMinutes % 60);

	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
		date.getHours()
	)}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(
		date.getMilliseconds(),
		3
	)}${offsetSign}${offsetHours}:${offsetRemainingMinutes}`;
};

const format = (level, message) => `[${getLocalTimestamp()}] [${level}] ${message}`;

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
