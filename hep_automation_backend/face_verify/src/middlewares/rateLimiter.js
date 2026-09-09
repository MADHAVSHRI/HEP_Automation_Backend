const rateLimit = require("express-rate-limit");

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MINUTES || 15) * 60 * 1000;

/**
 * Upload ceiling per address.
 *
 * Separate from the per-link attempt count in the session row: this bounds one
 * address hammering many links, that bounds many addresses hammering one link.
 * Neither covers the other.
 */
const uploadLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.RATE_LIMIT_UPLOADS || 20),
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." },
});

const globalLimiter = rateLimit({
  windowMs: WINDOW_MS,
  limit: Number(process.env.RATE_LIMIT_GLOBAL || 300),
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." },
  // The event stream is a single long-lived request that must not be counted
  // against a ceiling designed for short ones.
  skip: (req) => req.path.endsWith("/stream"),
});

module.exports = { uploadLimiter, globalLimiter };
