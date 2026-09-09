const crypto = require("crypto");

/*
 * Guards endpoints that only other services in this deployment may call — as
 * opposed to apiKeyAuth, which guards the endpoints external systems call.
 * The caller sends the shared secret in "x-service-key".
 */
const serviceAuth = (req, res, next) => {
  const providedKey = req.headers["x-service-key"];
  const expectedKey = process.env.SERVICE_AUTH_KEY;

  if (!expectedKey) {
    console.error("SERVICE_AUTH_KEY is not configured");
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }

  if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized: invalid service key" });
  }

  next();
};

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = serviceAuth;
