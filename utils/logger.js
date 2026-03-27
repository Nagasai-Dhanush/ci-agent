const winston = require("winston");

require("winston-daily-rotate-file");

const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
    trace: 4
};

const colors = {
    error: "red",
    warn: "yellow",
    info: "green",
    debug: "blue",
    trace: "gray"
};

winston.addColors(colors);

const format = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message, metadata }) => {
        const meta = metadata ? JSON.stringify(metadata, null, 2) : "";
        return `${timestamp} [${level.toUpperCase()}]: ${message} ${meta}`;
    })
);

const logger = winston.createLogger({
    levels,
    format,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                format
            )
        }),
        new winston.transports.File({
            filename: "logs/error.log",
            level: "error"
        }),
        new winston.transports.File({
            filename: "logs/combined.log"
        })
    ]
});

function log(level, message, metadata = {}) {
    logger.log(level, message, { metadata });
}

module.exports = {
    error: (msg, meta) => log("error", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    debug: (msg, meta) => log("debug", msg, meta),
    trace: (msg, meta) => log("trace", msg, meta)
};
