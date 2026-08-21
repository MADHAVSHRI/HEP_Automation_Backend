/**
 * Example usage of OTP utilities
 * This file demonstrates how to use the OTP generation and verification functions
 * in the multiple pass submissions feature (Requirements 22.2, 22.3, 22.7, 22.8)
 */

const { generateOTP, hashOTP, verifyOTP } = require("./otpUtils");

async function demonstrateOTPFlow() {
  console.log("=== OTP Utilities Demo ===\n");

  // Step 1: Generate OTP (Requirement 22.2)
  console.log("1. Generating 6-digit OTP...");
  const otp = generateOTP();
  console.log(`   Generated OTP: ${otp}`);
  console.log(`   Length: ${otp.length} digits\n`);

  // Step 2: Hash OTP for storage (Requirement 22.3)
  console.log("2. Hashing OTP with bcrypt (salt rounds: 10)...");
  const hash = await hashOTP(otp);
  console.log(`   Hashed OTP: ${hash.substring(0, 30)}...`);
  console.log(`   Hash length: ${hash.length} characters\n`);

  // Step 3: Verify correct OTP (Requirement 22.7)
  console.log("3. Verifying correct OTP...");
  const isValid = await verifyOTP(otp, hash);
  console.log(`   Verification result: ${isValid ? "✓ VALID" : "✗ INVALID"}\n`);

  // Step 4: Verify incorrect OTP
  console.log("4. Verifying incorrect OTP...");
  const wrongOTP = "999999";
  const isInvalid = await verifyOTP(wrongOTP, hash);
  console.log(`   Wrong OTP (${wrongOTP}): ${isInvalid ? "✓ VALID" : "✗ INVALID"}\n`);

  console.log("=== Demo Complete ===");
}

// Run demonstration
if (require.main === module) {
  demonstrateOTPFlow().catch(console.error);
}

module.exports = { demonstrateOTPFlow };
