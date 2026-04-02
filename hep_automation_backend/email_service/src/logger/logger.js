const winston = require("winston");
const fs = require("fs");
const path = require("path");

const today = new Date().toISOString().split("T")[0];

const logDir = path.join(__dirname, "../../logs", today);

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const successLogger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "success.log")
    })
  ]
});

const errorLogger = winston.createLogger({
  level: "error",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "error.log")
    })
  ]
});

module.exports = {
  successLogger,
  errorLogger
};