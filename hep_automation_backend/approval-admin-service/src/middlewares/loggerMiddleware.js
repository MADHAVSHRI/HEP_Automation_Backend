const { successLogger, errorLogger } = require("../logger/logger");

const loggerMiddleware = (req, res, next) => {

  const start = Date.now();

  res.on("finish", () => {

    const duration = Date.now() - start;

    const logMessage = `${new Date().toISOString()} | ${req.method} | ${req.originalUrl} | ${res.statusCode} | ${duration}ms`;

    if (res.statusCode < 400) {

      console.log("SUCCESS:", logMessage);
      successLogger.info(logMessage);

    } else {

      console.error("ERROR:", logMessage);
      errorLogger.error(logMessage);

    }

  });

  next();
};

module.exports = loggerMiddleware;