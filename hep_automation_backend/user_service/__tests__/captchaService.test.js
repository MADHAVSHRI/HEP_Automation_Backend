const captchaService = require('../src/services/captchaService');
const redisClient = require('../config/redisClient');

// Mock Redis client
jest.mock('../config/redisClient', () => ({
  setEx: jest.fn(),
  get: jest.fn(),
  del: jest.fn()
}));

describe('CAPTCHA Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateCaptcha', () => {
    it('should generate a CAPTCHA with question, token, answer, and expiresIn', () => {
      const captcha = captchaService.generateCaptcha();
      
      expect(captcha).toHaveProperty('question');
      expect(captcha).toHaveProperty('token');
      expect(captcha).toHaveProperty('answer');
      expect(captcha).toHaveProperty('expiresIn');
      expect(captcha.expiresIn).toBe(120);
    });

    it('should generate a valid math question with single-digit numbers', () => {
      const captcha = captchaService.generateCaptcha();
      
      // Question format should be "What is X + Y?" or "What is X - Y?"
      expect(captcha.question).toMatch(/^What is \d \+ \d\?$|^What is \d - \d\?$/);
    });

    it('should generate a valid UUID token', () => {
      const captcha = captchaService.generateCaptcha();
      
      // UUID v4 format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(captcha.token).toMatch(uuidRegex);
    });

    it('should generate correct answer for addition', () => {
      // Run multiple times to test addition
      for (let i = 0; i < 10; i++) {
        const captcha = captchaService.generateCaptcha();
        
        if (captcha.question.includes('+')) {
          const match = captcha.question.match(/What is (\d) \+ (\d)\?/);
          const num1 = parseInt(match[1]);
          const num2 = parseInt(match[2]);
          
          expect(captcha.answer).toBe(num1 + num2);
        }
      }
    });

    it('should generate correct answer for subtraction', () => {
      // Run multiple times to test subtraction
      for (let i = 0; i < 10; i++) {
        const captcha = captchaService.generateCaptcha();
        
        if (captcha.question.includes('-')) {
          const match = captcha.question.match(/What is (\d) - (\d)\?/);
          const num1 = parseInt(match[1]);
          const num2 = parseInt(match[2]);
          
          expect(captcha.answer).toBe(num1 - num2);
          // Ensure non-negative result
          expect(captcha.answer).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('should generate unique tokens for multiple CAPTCHAs', () => {
      const tokens = new Set();
      
      for (let i = 0; i < 100; i++) {
        const captcha = captchaService.generateCaptcha();
        tokens.add(captcha.token);
      }
      
      // All tokens should be unique
      expect(tokens.size).toBe(100);
    });
  });

  describe('storeCaptchaAnswer', () => {
    it('should store CAPTCHA answer in Redis with 120 second TTL', async () => {
      redisClient.setEx.mockResolvedValue('OK');
      
      const token = 'test-uuid-token';
      const answer = 12;
      
      const result = await captchaService.storeCaptchaAnswer(token, answer);
      
      expect(result).toBe(true);
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `captcha:${token}`,
        120,
        '12'
      );
    });

    it('should throw error if Redis operation fails', async () => {
      redisClient.setEx.mockRejectedValue(new Error('Redis error'));
      
      const token = 'test-uuid-token';
      const answer = 12;
      
      await expect(captchaService.storeCaptchaAnswer(token, answer))
        .rejects.toThrow('Failed to store CAPTCHA answer');
    });

    it('should convert numeric answer to string when storing', async () => {
      redisClient.setEx.mockResolvedValue('OK');
      
      const token = 'test-uuid-token';
      const answer = 5;
      
      await captchaService.storeCaptchaAnswer(token, answer);
      
      expect(redisClient.setEx).toHaveBeenCalledWith(
        `captcha:${token}`,
        120,
        '5'
      );
    });
  });

  describe('verifyCaptcha', () => {
    it('should return true for correct answer', async () => {
      const token = 'test-uuid-token';
      const correctAnswer = '12';
      
      redisClient.get.mockResolvedValue(correctAnswer);
      redisClient.del.mockResolvedValue(1);
      
      const result = await captchaService.verifyCaptcha(token, correctAnswer);
      
      expect(result).toBe(true);
      expect(redisClient.get).toHaveBeenCalledWith(`captcha:${token}`);
      expect(redisClient.del).toHaveBeenCalledWith(`captcha:${token}`);
    });

    it('should return false for incorrect answer', async () => {
      const token = 'test-uuid-token';
      const storedAnswer = '12';
      const userAnswer = '10';
      
      redisClient.get.mockResolvedValue(storedAnswer);
      redisClient.del.mockResolvedValue(1);
      
      const result = await captchaService.verifyCaptcha(token, userAnswer);
      
      expect(result).toBe(false);
      expect(redisClient.del).toHaveBeenCalled();
    });

    it('should return false for expired or invalid token', async () => {
      const token = 'invalid-token';
      
      redisClient.get.mockResolvedValue(null);
      redisClient.del.mockResolvedValue(0);
      
      const result = await captchaService.verifyCaptcha(token, '12');
      
      expect(result).toBe(false);
    });

    it('should delete token from Redis after verification (one-time use)', async () => {
      const token = 'test-uuid-token';
      
      redisClient.get.mockResolvedValue('12');
      redisClient.del.mockResolvedValue(1);
      
      await captchaService.verifyCaptcha(token, '12');
      
      expect(redisClient.del).toHaveBeenCalledWith(`captcha:${token}`);
    });

    it('should accept numeric answer and compare correctly', async () => {
      const token = 'test-uuid-token';
      
      redisClient.get.mockResolvedValue('12');
      redisClient.del.mockResolvedValue(1);
      
      const result = await captchaService.verifyCaptcha(token, 12);
      
      expect(result).toBe(true);
    });

    it('should throw error if Redis operation fails', async () => {
      redisClient.get.mockRejectedValue(new Error('Redis error'));
      
      await expect(captchaService.verifyCaptcha('token', '12'))
        .rejects.toThrow('Failed to verify CAPTCHA');
    });

    it('should delete token even if verification fails', async () => {
      const token = 'test-uuid-token';
      
      redisClient.get.mockResolvedValue('12');
      redisClient.del.mockResolvedValue(1);
      
      await captchaService.verifyCaptcha(token, 'wrong-answer');
      
      expect(redisClient.del).toHaveBeenCalledWith(`captcha:${token}`);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete CAPTCHA lifecycle', async () => {
      // Generate CAPTCHA
      const captcha = captchaService.generateCaptcha();
      
      expect(captcha.token).toBeDefined();
      expect(captcha.answer).toBeDefined();
      
      // Store answer
      redisClient.setEx.mockResolvedValue('OK');
      const stored = await captchaService.storeCaptchaAnswer(captcha.token, captcha.answer);
      expect(stored).toBe(true);
      
      // Verify with correct answer
      redisClient.get.mockResolvedValue(captcha.answer.toString());
      redisClient.del.mockResolvedValue(1);
      const verified = await captchaService.verifyCaptcha(captcha.token, captcha.answer);
      expect(verified).toBe(true);
    });

    it('should enforce one-time use by deleting token', async () => {
      const token = 'test-token';
      
      // First verification
      redisClient.get.mockResolvedValueOnce('12');
      redisClient.del.mockResolvedValue(1);
      await captchaService.verifyCaptcha(token, '12');
      
      // Second verification should fail (token deleted)
      redisClient.get.mockResolvedValueOnce(null);
      const result = await captchaService.verifyCaptcha(token, '12');
      expect(result).toBe(false);
    });
  });
});
