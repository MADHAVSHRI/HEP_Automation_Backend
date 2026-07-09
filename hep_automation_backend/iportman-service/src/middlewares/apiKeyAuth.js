const crypto = require("crypto");

// Protects the weighbridge integration endpoints. The caller (APAC / weighbridge
// system) must send the shared secret in the "Apacs-api-key" header.
const apiKeyAuth = (req, res, next) => {
  const providedKey = req.headers["apacs-api-key"];
  const expectedKey = process.env.IPORTAN_API_KEY;

  if (!expectedKey) {
    console.error("IPORTAN_API_KEY is not configured");
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }

  if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: invalid or missing API key",
    });
  }

  next();
};

// Constant-time comparison to avoid leaking the key via timing differences.
function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = apiKeyAuth;
