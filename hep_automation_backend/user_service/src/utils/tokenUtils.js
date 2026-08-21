const crypto = require("crypto");
const jwt = require("jsonwebtoken");

/**
 * Token Encryption Utilities for Multiple Pass Submissions Feature
 * 
 * This module provides secure token generation, encryption, and decryption
 * for upload tokens used in bulk pass submissions.
 * 
 * Security Features:
 * - JWT for signed token generation with expiry
 * - AES-256-CBC encryption for token obfuscation
 * - Environment-based encryption keys
 */

// Environment variable getters with validation
const getEnvVariable = (key, defaultValue = null) => {
  const value = process.env[key];
  if (!value && !defaultValue) {
    console.warn(`[tokenUtils] Warning: Environment variable ${key} is not set`);
  }
  return value || defaultValue;
};

// Get encryption configuration from environment
const getEncryptionKey = () => {
  const key = getEnvVariable("ENCRYPTION_KEY");
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is required");
  }
  // Ensure key is exactly 32 bytes for AES-256
  return crypto.createHash("sha256").update(key).digest();
};

const getEncryptionIV = () => {
  const iv = getEnvVariable("ENCRYPTION_IV");
  if (!iv) {
    throw new Error("ENCRYPTION_IV environment variable is required");
  }
  // Ensure IV is exactly 16 bytes for AES-256-CBC
  return crypto.createHash("md5").update(iv).digest();
};

const getUploadTokenSecret = () => {
  return getEnvVariable("UPLOAD_TOKEN_SECRET", getEnvVariable("JWT_SECRET"));
};

/**
 * Generate Upload Token (JWT)
 * 
 * Creates a signed JWT token containing batch information for upload validation
 * 
 * @param {number} batchId - The batch ID (parent_request_id or parent batch ID)
 * @param {string} source - The source type: 'DEPARTMENT' | 'PUBLIC_WEBSITE'
 * @param {object} options - Additional options
 * @param {string} options.expiresIn - Token expiry time (default: '365d')
 * @returns {string} JWT token
 * 
 * @example
 * const token = generateUploadToken(123, 'DEPARTMENT');
 */
const generateUploadToken = (batchId, source, options = {}) => {
  try {
    // Validate inputs
    if (!batchId || typeof batchId !== "number") {
      throw new Error("Invalid batchId: must be a number");
    }
    
    const validSources = ["DEPARTMENT", "PUBLIC_WEBSITE"];
    if (!source || !validSources.includes(source)) {
      throw new Error(`Invalid source: must be one of ${validSources.join(", ")}`);
    }

    // Construct JWT payload
    const payload = {
      batchId: batchId,
      source: source,
      type: "upload_token",
      iat: Math.floor(Date.now() / 1000) // Issued at timestamp
    };

    // JWT sign options
    const signOptions = {
      expiresIn: options.expiresIn || "365d", // Default 1 year validity
      algorithm: "HS256"
    };

    const secret = getUploadTokenSecret();
    const token = jwt.sign(payload, secret, signOptions);

    return token;
  } catch (error) {
    console.error("[tokenUtils] Error generating upload token:", error.message);
    throw error;
  }
};

/**
 * Encrypt Token using AES-256-CBC
 * 
 * Encrypts a plaintext token (typically a JWT) for secure transmission
 * 
 * @param {string} token - The plaintext token to encrypt
 * @returns {string} Base64-encoded encrypted token
 * 
 * @example
 * const encrypted = encryptToken(jwtToken);
 */
const encryptToken = (token) => {
  try {
    if (!token || typeof token !== "string") {
      throw new Error("Invalid token: must be a non-empty string");
    }

    const key = getEncryptionKey();
    const iv = getEncryptionIV();

    const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
    
    let encrypted = cipher.update(token, "utf8", "base64");
    encrypted += cipher.final("base64");

    return encrypted;
  } catch (error) {
    console.error("[tokenUtils] Error encrypting token:", error.message);
    throw error;
  }
};

/**
 * Decrypt Token using AES-256-CBC
 * 
 * Decrypts an encrypted token back to plaintext
 * 
 * @param {string} encryptedToken - The base64-encoded encrypted token
 * @returns {string} Plaintext decrypted token
 * 
 * @example
 * const decrypted = decryptToken(encryptedToken);
 */
const decryptToken = (encryptedToken) => {
  try {
    if (!encryptedToken || typeof encryptedToken !== "string") {
      throw new Error("Invalid encrypted token: must be a non-empty string");
    }

    const key = getEncryptionKey();
    const iv = getEncryptionIV();

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    
    let decrypted = decipher.update(encryptedToken, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch (error) {
    console.error("[tokenUtils] Error decrypting token:", error.message);
    throw error;
  }
};

/**
 * Verify Upload Token
 * 
 * Decrypts and verifies a JWT upload token, returning the payload if valid
 * 
 * @param {string} encryptedToken - The encrypted JWT token
 * @returns {object} Decoded JWT payload containing batchId and source
 * @throws {Error} If token is invalid, expired, or decryption fails
 * 
 * @example
 * try {
 *   const payload = verifyUploadToken(encryptedToken);
 *   console.log(payload.batchId, payload.source);
 * } catch (error) {
 *   console.error('Invalid token:', error.message);
 * }
 */
const verifyUploadToken = (encryptedToken) => {
  try {
    if (!encryptedToken || typeof encryptedToken !== "string") {
      throw new Error("Invalid encrypted token: must be a non-empty string");
    }

    // Step 1: Decrypt the token
    const decryptedToken = decryptToken(encryptedToken);

    // Step 2: Verify JWT signature and expiry
    const secret = getUploadTokenSecret();
    const payload = jwt.verify(decryptedToken, secret);

    // Step 3: Validate token type
    if (payload.type !== "upload_token") {
      throw new Error("Invalid token type");
    }

    // Step 4: Validate required fields
    if (!payload.batchId || !payload.source) {
      throw new Error("Invalid token payload: missing required fields");
    }

    return payload;
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token signature");
    } else if (error.name === "TokenExpiredError") {
      throw new Error("Token has expired");
    } else {
      console.error("[tokenUtils] Error verifying upload token:", error.message);
      throw error;
    }
  }
};

module.exports = {
  generateUploadToken,
  encryptToken,
  decryptToken,
  verifyUploadToken
};
