const allowedOrigins = require("./allowedOrigins");

function allowCredentials(req, res, next) {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || !origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", true);
  }

  next();
}

module.exports = allowCredentials;
