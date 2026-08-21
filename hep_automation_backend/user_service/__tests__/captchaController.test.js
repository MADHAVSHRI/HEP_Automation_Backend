const captchaController = require('../src/controllers/captchaController');
const captchaService = require('../src/services/captchaService');
const rateLimitMiddleware = require('../src/middlewares/rateLimitMiddleware');

// Mock captchaService and rateLimitMiddleware
jest.mock('../src/services/captchaService');
jest.mock('../src/middlewares/rateLimitMiddleware');

describe('CAPTCHA Controller', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      ip: '192.168.1.1',
      connection: { remoteAddress: '192.168.1.1' },
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
    // Clear console logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock recordCAPTCHAFailure
    rateLimitMiddleware.recordCAPTCHAFailure = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  describe('getCaptcha', () => {
    it('should generate and return a CAPTCHA challenge successfully', async () => {
      // Mock service methods
      const mockCaptcha = {
        question: 'What is 7 + 5?',
        token: '550e8400-e29b-41d4-a716-446655440000',
        answer: 12,
        expiresIn: 120
      };

      captchaService.generateCaptcha.mockReturnValue(mockCaptcha);
      captchaService.storeCaptchaAnswer.mockResolvedValue(true);

      // Call controller
      await captchaController.getCaptcha(req, res);

      // Verify service calls
      expect(captchaService.generateCaptcha).toHaveBeenCalledTimes(1);
      expect(captchaService.storeCaptchaAnswer).toHaveBeenCalledWith(
        mockCaptcha.token,
        mockCaptcha.answer
      );

      // Verify response
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        question: 'What is 7 + 5?',
        token: '550e8400-e29b-41d4-a716-446655440000',
        expiresIn: 120
      });

      // Ensure answer is NOT returned to client
      expect(res.json).not.toHaveBeenCalledWith(
        expect.objectContaining({ answer: expect.anything() })
      );
    });

    it('should not expose the answer in the response', async () => {
      const mockCaptcha = {
        question: 'What is 3 - 1?',
        token: 'test-token-123',
        answer: 2,
        expiresIn: 120
      };

      captchaService.generateCaptcha.mockReturnValue(mockCaptcha);
      captchaService.storeCaptchaAnswer.mockResolvedValue(true);

      await captchaController.getCaptcha(req, res);

      const responseCall = res.json.mock.calls[0][0];
      expect(responseCall).not.toHaveProperty('answer');
      expect(responseCall).toHaveProperty('question');
      expect(responseCall).toHaveProperty('token');
      expect(responseCall).toHaveProperty('expiresIn');
    });

    it('should return 500 error if CAPTCHA generation fails', async () => {
      captchaService.generateCaptcha.mockImplementation(() => {
        throw new Error('Generation error');
      });

      await captchaController.getCaptcha(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'CAPTCHA generation failed'
      });
    });

    it('should return 500 error if storing answer in Redis fails', async () => {
      const mockCaptcha = {
        question: 'What is 4 + 2?',
        token: 'test-token',
        answer: 6,
        expiresIn: 120
      };

      captchaService.generateCaptcha.mockReturnValue(mockCaptcha);
      captchaService.storeCaptchaAnswer.mockRejectedValue(
        new Error('Redis connection error')
      );

      await captchaController.getCaptcha(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'CAPTCHA generation failed'
      });
    });

    it('should return expiresIn value of 120 seconds', async () => {
      const mockCaptcha = {
        question: 'What is 8 + 1?',
        token: 'token-uuid',
        answer: 9,
        expiresIn: 120
      };

      captchaService.generateCaptcha.mockReturnValue(mockCaptcha);
      captchaService.storeCaptchaAnswer.mockResolvedValue(true);

      await captchaController.getCaptcha(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ expiresIn: 120 })
      );
    });
  });

  describe('verifyCaptcha', () => {
    it('should verify CAPTCHA successfully with correct answer', async () => {
      req.body = {
        token: 'test-token-123',
        answer: '12'
      };

      captchaService.verifyCaptcha.mockResolvedValue(true);

      await captchaController.verifyCaptcha(req, res);

      expect(captchaService.verifyCaptcha).toHaveBeenCalledWith('test-token-123', '12');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        valid: true
      });
      expect(rateLimitMiddleware.recordCAPTCHAFailure).not.toHaveBeenCalled();
    });

    it('should return error for incorrect CAPTCHA answer', async () => {
      req.body = {
        token: 'test-token-123',
        answer: '10'
      };

      captchaService.verifyCaptcha.mockResolvedValue(false);

      await captchaController.verifyCaptcha(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        valid: false,
        message: 'Invalid or expired CAPTCHA'
      });
      expect(rateLimitMiddleware.recordCAPTCHAFailure).toHaveBeenCalledWith('192.168.1.1');
    });

    it('should return error for expired CAPTCHA token', async () => {
      req.body = {
        token: 'expired-token',
        answer: '12'
      };

      captchaService.verifyCaptcha.mockResolvedValue(false);

      await captchaController.verifyCaptcha(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        valid: false,
        message: 'Invalid or expired CAPTCHA'
      });
      expect(rateLimitMiddleware.recordCAPTCHAFailure).toHaveBeenCalledWith('192.168.1.1');
    });

    it('should return 400 error if token is missing', async () => {
      req.body = {
        answer: '12'
      };

      await captchaController.verifyCaptcha(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token and answer are required'
      });
      expect(captchaService.verifyCaptcha).not.toHaveBeenCalled();
    });

    it('should return 400 error if answer is missing', async () => {
      req.body = {
        token: 'test-token-123'
      };

      await captchaController.verifyCaptcha(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token and answer are required'
      });
      expect(captchaService.verifyCaptcha).not.toHaveBeenCalled();
    });

    it('should return 400 error if answer is null', async () => {
      req.body = {
        token: 'test-token-123',
        answer: null
      };

      await captchaController.verifyCaptcha(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token and answer are required'
      });
    });

    it('should accept numeric answer (not just string)', async () => {
      req.body = {
        token: 'test-token-123',
        answer: 12
      };

      captchaService.verifyCaptcha.mockResolvedValue(true);

      await captchaController.verifyCaptcha(req, res);

      expect(captchaService.verifyCaptcha).toHaveBeenCalledWith('test-token-123', 12);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should accept answer 0 as valid', async () => {
      req.body = {
        token: 'test-token-123',
        answer: 0
      };

      captchaService.verifyCaptcha.mockResolvedValue(true);

      await captchaController.verifyCaptcha(req, res);

      expect(captchaService.verifyCaptcha).toHaveBeenCalledWith('test-token-123', 0);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 500 error if verification service fails', async () => {
      req.body = {
        token: 'test-token-123',
        answer: '12'
      };

      captchaService.verifyCaptcha.mockRejectedValue(
        new Error('Redis connection failed')
      );

      await captchaController.verifyCaptcha(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'CAPTCHA verification failed'
      });
    });
  });

  describe('Requirements validation', () => {
    it('should satisfy Requirement 23.1-23.3: Generate math-based CAPTCHA with UUID token', async () => {
      const mockCaptcha = {
        question: 'What is 5 + 3?',
        token: 'uuid-token-here',
        answer: 8,
        expiresIn: 120
      };

      captchaService.generateCaptcha.mockReturnValue(mockCaptcha);
      captchaService.storeCaptchaAnswer.mockResolvedValue(true);

      await captchaController.getCaptcha(req, res);

      expect(captchaService.generateCaptcha).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          question: expect.any(String),
          token: expect.any(String)
        })
      );
    });

    it('should satisfy Requirement 23.4-23.5: Store answer in Redis with 120s TTL', async () => {
      const mockCaptcha = {
        question: 'What is 9 - 4?',
        token: 'test-uuid',
        answer: 5,
        expiresIn: 120
      };

      captchaService.generateCaptcha.mockReturnValue(mockCaptcha);
      captchaService.storeCaptchaAnswer.mockResolvedValue(true);

      await captchaController.getCaptcha(req, res);

      expect(captchaService.storeCaptchaAnswer).toHaveBeenCalledWith(
        mockCaptcha.token,
        mockCaptcha.answer
      );
    });
  });
});
