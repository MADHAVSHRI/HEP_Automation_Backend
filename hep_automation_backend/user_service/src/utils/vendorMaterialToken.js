const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const keyHex =
    process.env.MATERIAL_LINK_ENCRYPTION_KEY;

  if (
    !keyHex ||
    !/^[a-fA-F0-9]{64}$/.test(keyHex)
  ) {
    throw new Error(
      "MATERIAL_LINK_ENCRYPTION_KEY must be a 64-character hexadecimal value."
    );
  }

  return Buffer.from(keyHex, "hex");
}

function generatePublicToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(String(token), "utf8")
    .digest("hex");
}

function encryptToken(token) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(
    ALGORITHM,
    key,
    iv,
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  const encrypted = Buffer.concat([
    cipher.update(String(token), "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptToken(encryptedValue) {
  const parts = String(encryptedValue || "").split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format.");
  }

  const [ivValue, tagValue, cipherValue] = parts;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, "base64url"),
    {
      authTagLength: AUTH_TAG_LENGTH,
    }
  );

  decipher.setAuthTag(
    Buffer.from(tagValue, "base64url")
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(cipherValue, "base64url")
    ),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

function safeTokenEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}

module.exports = {
  generatePublicToken,
  hashToken,
  encryptToken,
  decryptToken,
  safeTokenEqual,
};