const allowedOrigins = require("./allowedOrigins");

function allowCredentials(req, res, next) {
  const origin = req.headers.origin;
  console.log("Request Origin:", origin);  // Log the origin
  if (allowedOrigins.includes(origin) || !origin) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", true);
  } else {
    console.log(`Origin "${origin}" is not allowed by CORS.`);
  }
  next();
}

module.exports = allowCredentials;