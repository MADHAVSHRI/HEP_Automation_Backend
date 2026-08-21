const { generateOTP, hashOTP, verifyOTP } = require("../src/utils/otpUtils");
const bcrypt = require("bcrypt");

describe("OTP Utils", () => {
  describe("generateOTP", () => {
    it("should generate a 6-digit OTP", () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
    });

    it("should generate a numeric string", () => {
      const otp = generateOTP();
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("should generate different OTPs on multiple calls", () => {
      const otp1 = generateOTP();
      const otp2 = generateOTP();
      const otp3 = generateOTP();
      
      // While technically possible for two to match, it's extremely unlikely
      const otps = [otp1, otp2, otp3];
      const uniqueOTPs = new Set(otps);
      expect(uniqueOTPs.size).toBeGreaterThanOrEqual(2);
    });

    it("should generate OTPs within valid range (100000-999999)", () => {
      for (let i = 0; i < 10; i++) {
        const otp = generateOTP();
        const numericOtp = parseInt(otp, 10);
        expect(numericOtp).toBeGreaterThanOrEqual(100000);
        expect(numericOtp).toBeLessThanOrEqual(999999);
      }
    });

    it("should not generate OTP with leading zeros", () => {
      for (let i = 0; i < 10; i++) {
        const otp = generateOTP();
        expect(otp[0]).not.toBe("0");
      }
    });
  });

  describe("hashOTP", () => {
    it("should hash an OTP successfully", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
      expect(hash.length).toBeGreaterThan(0);
    });

    it("should generate a bcrypt hash (starts with $2b$)", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      
      expect(hash).toMatch(/^\$2b\$/);
    });

    it("should generate different hashes for the same OTP (due to salt)", async () => {
      const otp = "123456";
      const hash1 = await hashOTP(otp);
      const hash2 = await hashOTP(otp);
      
      expect(hash1).not.toBe(hash2);
    });

    it("should handle numeric OTP values", async () => {
      const otp = 123456;
      const hash = await hashOTP(otp);
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe("string");
    });

    it("should throw error when OTP is empty", async () => {
      await expect(hashOTP("")).rejects.toThrow("OTP is required for hashing");
    });

    it("should throw error when OTP is null", async () => {
      await expect(hashOTP(null)).rejects.toThrow("OTP is required for hashing");
    });

    it("should throw error when OTP is undefined", async () => {
      await expect(hashOTP(undefined)).rejects.toThrow("OTP is required for hashing");
    });

    it("should use salt rounds 10", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      
      // Bcrypt hash format: $2b$rounds$salthash
      // Extract rounds from hash
      const rounds = hash.split("$")[2];
      expect(rounds).toBe("10");
    });
  });

  describe("verifyOTP", () => {
    it("should verify a correct OTP", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      const isValid = await verifyOTP(otp, hash);
      
      expect(isValid).toBe(true);
    });

    it("should reject an incorrect OTP", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      const isValid = await verifyOTP("654321", hash);
      
      expect(isValid).toBe(false);
    });

    it("should verify OTP with numeric input", async () => {
      const otp = 123456;
      const hash = await hashOTP(otp);
      const isValid = await verifyOTP(123456, hash);
      
      expect(isValid).toBe(true);
    });

    it("should handle mixed string and numeric OTP verification", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      const isValid = await verifyOTP(123456, hash);
      
      expect(isValid).toBe(true);
    });

    it("should return false when OTP is empty", async () => {
      const hash = await hashOTP("123456");
      const isValid = await verifyOTP("", hash);
      
      expect(isValid).toBe(false);
    });

    it("should return false when OTP is null", async () => {
      const hash = await hashOTP("123456");
      const isValid = await verifyOTP(null, hash);
      
      expect(isValid).toBe(false);
    });

    it("should return false when hash is empty", async () => {
      const isValid = await verifyOTP("123456", "");
      
      expect(isValid).toBe(false);
    });

    it("should return false when hash is null", async () => {
      const isValid = await verifyOTP("123456", null);
      
      expect(isValid).toBe(false);
    });

    it("should return false when both OTP and hash are null", async () => {
      const isValid = await verifyOTP(null, null);
      
      expect(isValid).toBe(false);
    });

    it("should return false for invalid hash format", async () => {
      const isValid = await verifyOTP("123456", "invalid_hash");
      
      expect(isValid).toBe(false);
    });

    it("should handle slightly different OTPs", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      
      const testCases = [
        "123457", // Last digit different
        "023456", // First digit different
        "12345",  // Too short
        "1234567", // Too long
        "abcdef"  // Non-numeric
      ];
      
      for (const testOtp of testCases) {
        const isValid = await verifyOTP(testOtp, hash);
        expect(isValid).toBe(false);
      }
    });

    it("should handle bcrypt compare errors gracefully", async () => {
      // Create a spy to mock bcrypt.compare throwing an error
      const originalCompare = bcrypt.compare;
      bcrypt.compare = jest.fn().mockRejectedValue(new Error("Bcrypt error"));
      
      const isValid = await verifyOTP("123456", "some_hash");
      
      expect(isValid).toBe(false);
      
      // Restore original function
      bcrypt.compare = originalCompare;
    });
  });

  describe("Integration: Full OTP workflow", () => {
    it("should generate, hash, and verify OTP successfully", async () => {
      // Generate OTP
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      
      // Hash the OTP
      const hash = await hashOTP(otp);
      expect(hash).toBeDefined();
      
      // Verify the OTP
      const isValid = await verifyOTP(otp, hash);
      expect(isValid).toBe(true);
    });

    it("should reject verification after OTP change", async () => {
      // Generate and hash first OTP
      const otp1 = generateOTP();
      const hash1 = await hashOTP(otp1);
      
      // Try to verify with different OTP
      const otp2 = generateOTP();
      const isValid = await verifyOTP(otp2, hash1);
      
      expect(isValid).toBe(false);
    });

    it("should handle multiple OTPs independently", async () => {
      // Generate multiple OTPs
      const otp1 = generateOTP();
      const otp2 = generateOTP();
      
      // Hash them
      const hash1 = await hashOTP(otp1);
      const hash2 = await hashOTP(otp2);
      
      // Verify correct pairs
      expect(await verifyOTP(otp1, hash1)).toBe(true);
      expect(await verifyOTP(otp2, hash2)).toBe(true);
      
      // Verify incorrect pairs
      expect(await verifyOTP(otp1, hash2)).toBe(false);
      expect(await verifyOTP(otp2, hash1)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("should handle OTP with leading spaces", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      const isValid = await verifyOTP(" 123456", hash);
      
      // Should fail because spaces make it different
      expect(isValid).toBe(false);
    });

    it("should handle OTP with trailing spaces", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      const isValid = await verifyOTP("123456 ", hash);
      
      // Should fail because spaces make it different
      expect(isValid).toBe(false);
    });

    it("should be case-insensitive for numeric OTPs", async () => {
      const otp = "123456";
      const hash = await hashOTP(otp);
      
      // Numeric OTPs should work consistently
      expect(await verifyOTP("123456", hash)).toBe(true);
      expect(await verifyOTP(123456, hash)).toBe(true);
    });
  });
});
