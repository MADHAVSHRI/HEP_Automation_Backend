const crypto = require("crypto");

/**
 * A link token: 32 bytes of randomness, URL-safe.
 *
 * This is the only thing protecting the upload, so it must be long enough that
 * guessing is hopeless and short enough to survive being pasted into a message.
 */
const generateToken = () => crypto.randomBytes(32).toString("base64url");

/**
 * Stored form of a token.
 *
 * Plain SHA-256, deliberately not bcrypt. Password hashes are slow to defend a
 * low-entropy secret a human chose; the input here is 256 bits of uniform
 * randomness, where a fast hash is already unbreakable — and this runs on every
 * request the applicant makes.
 */
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

module.exports = { generateToken, hashToken };
