/**
 * Unit Tests for EmailVerification Model
 * 
 * Tests OTP generation, hashing, verification, expiry checking,
 * and email validation without requiring a live database connection.
 * 
 * Requirements: 22.3, 22.4, 22.8
 */

const EmailVerification = require('../src/models/EmailVerification');

describe('EmailVerification Model - Pure Logic Tests', () => {

  describe('OTP Generation', () => {
    test('should generate a 6-digit OTP', () => {
      const otp = EmailVerification.generateOTP();
      
      expect(otp).toMatch(/^\d{6}$/);
      expect(otp.length).toBe(6);
      expect(parseInt(otp, 10)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(otp, 10)).toBeLessThanOrEqual(999999);
    });

    test('should generate unique OTPs', () => {
      const otps = new Set();
      for (let i = 0; i < 100; i++) {
        otps.add(EmailVerification.generateOTP());
      }
      
      // Should have high uniqueness (allowing for some collisions in 100 attempts)
      expect(otps.size).toBeGreaterThan(90);
    });
  });

  describe('OTP Hashing and Verification', () => {
    test('should hash OTP using bcrypt', async () => {
      const otp = '123456';
      const hash = await EmailVerification.hashOTP(otp);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(otp);
      expect(hash.length).toBeGreaterThan(20); // bcrypt hashes are long
      expect(hash).toMatch(/^\$2[ayb]\$.{56}$/); // bcrypt format
    });

    test('should verify correct OTP against hash', async () => {
      const otp = '654321';
      const hash = await EmailVerification.hashOTP(otp);
      
      const isValid = await EmailVerification.verifyOTP(otp, hash);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect OTP against hash', async () => {
      const correctOtp = '123456';
      const incorrectOtp = '999999';
      const hash = await EmailVerification.hashOTP(correctOtp);
      
      const isValid = await EmailVerification.verifyOTP(incorrectOtp, hash);
      expect(isValid).toBe(false);
    });

    test('should return false for null or undefined OTP', async () => {
      const hash = await EmailVerification.hashOTP('123456');
      
      expect(await EmailVerification.verifyOTP(null, hash)).toBe(false);
      expect(await EmailVerification.verifyOTP(undefined, hash)).toBe(false);
      expect(await EmailVerification.verifyOTP('', hash)).toBe(false);
    });

    test('should return false for null or undefined hash', async () => {
      expect(await EmailVerification.verifyOTP('123456', null)).toBe(false);
      expect(await EmailVerification.verifyOTP('123456', undefined)).toBe(false);
      expect(await EmailVerification.verifyOTP('123456', '')).toBe(false);
    });
  });

  describe('Expiry Calculation', () => {
    test('should calculate expiry 10 minutes from now', () => {
      const beforeCall = Date.now();
      const expiry = EmailVerification.calculateExpiry();
      const afterCall = Date.now();
      
      const expiryTime = expiry.getTime();
      const expectedMin = beforeCall + (10 * 60 * 1000);
      const expectedMax = afterCall + (10 * 60 * 1000);
      
      expect(expiryTime).toBeGreaterThanOrEqual(expectedMin - 100); // Allow 100ms tolerance
      expect(expiryTime).toBeLessThanOrEqual(expectedMax + 100);
    });

    test('should return Date object', () => {
      const expiry = EmailVerification.calculateExpiry();
      expect(expiry).toBeInstanceOf(Date);
    });
  });

  describe('isExpired', () => {
    test('should return false for future expiry', () => {
      const verification = {
        expires_at: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes in future
      };
      
      expect(EmailVerification.isExpired(verification)).toBe(false);
    });

    test('should return true for past expiry', () => {
      const verification = {
        expires_at: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes in past
      };
      
      expect(EmailVerification.isExpired(verification)).toBe(true);
    });

    test('should return true for exactly expired time', () => {
      const verification = {
        expires_at: new Date(Date.now() - 1000) // 1 second in past
      };
      
      expect(EmailVerification.isExpired(verification)).toBe(true);
    });

    test('should return true for null or undefined verification', () => {
      expect(EmailVerification.isExpired(null)).toBe(true);
      expect(EmailVerification.isExpired(undefined)).toBe(true);
    });

    test('should return true for verification without expires_at', () => {
      const verification = { email: 'test@example.com' };
      expect(EmailVerification.isExpired(verification)).toBe(true);
    });
  });

  describe('Email Validation', () => {
    test('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@example.com',
        'user+tag@example.co.in',
        'user_name@example.com',
        'user123@example.com',
        'u@example.com',
        'user@sub.example.com',
        'user@example-domain.com',
        'first.last@example.com'
      ];

      validEmails.forEach(email => {
        expect(EmailVerification.validateEmailFormat(email)).toBe(true);
      });
    });

    test('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example .com',
        'user@.com',
        'user..name@example.com',
        'user@example..com',
        'user@example',
        null,
        undefined,
        123,
        'user@example.com user@example.com'
      ];

      invalidEmails.forEach(email => {
        expect(EmailVerification.validateEmailFormat(email)).toBe(false);
      });
    });

    test('should reject emails longer than 255 characters', () => {
      const longEmail = 'a'.repeat(250) + '@example.com'; // 262 characters
      expect(EmailVerification.validateEmailFormat(longEmail)).toBe(false);
    });

    test('should accept emails up to 255 characters', () => {
      const maxEmail = 'a'.repeat(243) + '@example.com'; // 255 characters
      expect(EmailVerification.validateEmailFormat(maxEmail)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    test('should handle OTP hashing with special characters gracefully', async () => {
      // Although OTPs are numeric, test robustness
      const specialOtp = '!@#$%^';
      const hash = await EmailVerification.hashOTP(specialOtp);
      
      expect(hash).toBeDefined();
      const isValid = await EmailVerification.verifyOTP(specialOtp, hash);
      expect(isValid).toBe(true);
    });

    test('should handle verification with very old expiry date', () => {
      const verification = {
        expires_at: new Date('2000-01-01T00:00:00Z')
      };
      
      expect(EmailVerification.isExpired(verification)).toBe(true);
    });

    test('should handle verification with far future expiry date', () => {
      const verification = {
        expires_at: new Date('2099-12-31T23:59:59Z')
      };
      
      expect(EmailVerification.isExpired(verification)).toBe(false);
    });
  });

  describe('OTP Format Consistency', () => {
    test('should always generate numeric-only OTPs', () => {
      for (let i = 0; i < 50; i++) {
        const otp = EmailVerification.generateOTP();
        expect(/^\d+$/.test(otp)).toBe(true);
      }
    });

    test('should not generate OTPs with leading zeros that reduce length', () => {
      for (let i = 0; i < 50; i++) {
        const otp = EmailVerification.generateOTP();
        expect(otp.length).toBe(6);
      }
    });
  });

});
