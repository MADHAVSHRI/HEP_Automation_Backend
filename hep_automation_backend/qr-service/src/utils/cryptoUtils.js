const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

const getSecretKey = () => {
  const secret = process.env.JWT_SECRET || "default_jwt_secret_key_for_vendor_passes";
  // Create a 256-bit (32-byte) key by hashing the secret.
  // NOTE: must match user_service/src/utils/cryptoUtils.js (same JWT_SECRET)
  // so that ids encrypted here decrypt correctly in user_service.
  return crypto.createHash("sha256").update(secret).digest();
};

/**
 * Encrypts a plaintext string (e.g. database id) using AES-256-GCM.
 * Encodes the output in url-safe base64url format for compact, clean URLs.
 */
exports.encryptToken = (text) => {
  if (!text) return "";
  try {
    const key = getSecretKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(String(text), "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, encrypted, authTag]);
    return combined.toString("base64url");
  } catch (err) {
    console.error("[cryptoUtils] Encryption failed:", err.message);
    return "";
  }
};

/**
 * Decrypts a base64url-encoded encrypted token string.
 * Returns the plaintext or null if decryption fails.
 */
exports.decryptToken = (hash) => {
  if (!hash) return null;
  try {
    const combined = Buffer.from(hash, "base64url");
    if (combined.length < 28) return null;

    const iv = combined.subarray(0, 12);
    const authTag = combined.subarray(combined.length - 16);
    const ciphertext = combined.subarray(12, combined.length - 16);

    const key = getSecretKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, null, "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    return null;
  }
};
