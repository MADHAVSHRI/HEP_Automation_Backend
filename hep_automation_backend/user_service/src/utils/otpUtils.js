const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

/**
 * Generates a 6-digit random OTP (One-Time Password)
 * @returns {string} A 6-digit numeric string
 */
const generateOTP = () => {
  // Generate a random number between 100000 and 999999 (inclusive)
  const otp = Math.floor(100000 + Math.random() * 900000);
  return otp.toString();
};

/**
 * Hashes an OTP using bcrypt with salt rounds 10
 * @param {string} otp - The OTP to hash (must be a string)
 * @returns {Promise<string>} A promise that resolves to the hashed OTP
 */
const hashOTP = async (otp) => {
  if (!otp) {
    throw new Error("OTP is required for hashing");
  }
  
  // Convert to string if not already
  const otpString = String(otp);
  
  // Hash the OTP with bcrypt
  const hash = await bcrypt.hash(otpString, SALT_ROUNDS);
  return hash;
};

/**
 * Verifies an OTP against its hash using bcrypt.compare
 * @param {string} otp - The plain text OTP to verify
 * @param {string} hash - The hashed OTP to compare against
 * @returns {Promise<boolean>} A promise that resolves to true if OTP matches, false otherwise
 */
const verifyOTP = async (otp, hash) => {
  if (!otp || !hash) {
    return false;
  }
  
  // Convert to string if not already
  const otpString = String(otp);
  
  try {
    // Compare the OTP with the hash
    const isMatch = await bcrypt.compare(otpString, hash);
    return isMatch;
  } catch (error) {
    console.error("[otpUtils] OTP verification error:", error.message);
    return false;
  }
};

module.exports = {
  generateOTP,
  hashOTP,
  verifyOTP
};
