const axios = require("axios");
const publicRequestController = require("../src/controllers/publicRequestController");
const EmailVerification = require("../src/models/EmailVerification");
const { generateOTP, hashOTP } = require("../src/utils/otpUtils");

// Mock dependencies
jest.mock("axios");
jest.mock("../src/models/EmailVerification");
jest.mock("../src/utils/otpUtils");

describe("Public Request Controller - requestOTP", () => {
  let req, res;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  afterEach(() => {
    // Clean up environment
  });

  describe("Successful OTP request", () => {
    beforeEach(() => {
      process.env.EMAIL_SERVICE_URL = "http://localhost:3003";
    });

    it("should generate OTP, hash it, store in database, and send email", async () => {
      // Arrange
      const email = "test@example.com";
      const otp = "123456";
      const otpHash = "$2b$10$abcdefghijklmnopqrstuvwxyz";
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      req.body.email = email;

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(expiresAt);
      EmailVerification.create = jest.fn().mockResolvedValue({
        id: 1,
        email: email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        verified: false,
        attempts: 0
      });

      generateOTP.mockReturnValue(otp);
      hashOTP.mockResolvedValue(otpHash);

      axios.post.mockResolvedValue({
        status: 200,
        data: { success: true }
      });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(EmailVerification.validateEmailFormat).toHaveBeenCalledWith(email);
      expect(generateOTP).toHaveBeenCalled();
      expect(hashOTP).toHaveBeenCalledWith(otp);
      expect(EmailVerification.create).toHaveBeenCalledWith({
        email: email,
        otp_hash: otpHash,
        expires_at: expiresAt,
        verified: false,
        attempts: 0
      });
      expect(axios.post).toHaveBeenCalledWith(
        "http://localhost:3003/api/email/sendOTPEmail",
        {
          email: email,
          otp: otp
        },
        {
          headers: { "x-service-name": "USER-SERVICE" },
          timeout: 8000
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "OTP sent to your email",
        expiresIn: 600
      });
    });
  });

  describe("Email validation", () => {
    it("should return 400 if email is missing", async () => {
      // Arrange
      req.body.email = undefined;

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(false);

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email format"
      });
    });

    it("should return 400 if email format is invalid", async () => {
      // Arrange
      req.body.email = "invalid-email";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(false);

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(EmailVerification.validateEmailFormat).toHaveBeenCalledWith("invalid-email");
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email format"
      });
    });

    it("should accept valid RFC 5322 email formats", async () => {
      // Arrange
      process.env.EMAIL_SERVICE_URL = "http://localhost:3003";
      
      const validEmails = [
        "user@example.com",
        "user.name@example.com",
        "user+tag@example.co.uk",
        "user_name@sub.example.com"
      ];

      for (const email of validEmails) {
        jest.clearAllMocks();
        req.body.email = email;

        EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
        EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
        EmailVerification.create = jest.fn().mockResolvedValue({});
        generateOTP.mockReturnValue("123456");
        hashOTP.mockResolvedValue("hash");
        axios.post.mockResolvedValue({ status: 200, data: { success: true } });

        // Act
        await publicRequestController.requestOTP(req, res);

        // Assert
        expect(EmailVerification.validateEmailFormat).toHaveBeenCalledWith(email);
        expect(res.status).toHaveBeenCalledWith(200);
      }
    });
  });

  describe("Email service integration", () => {
    it("should return 500 if EMAIL_SERVICE_URL is not configured", async () => {
      // Arrange
      delete process.env.EMAIL_SERVICE_URL;
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue("123456");
      hashOTP.mockResolvedValue("hash");

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Email service is not available"
      });
    });

    it("should return 500 if email service fails to send OTP", async () => {
      // Arrange
      process.env.EMAIL_SERVICE_URL = "http://localhost:3003";
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue("123456");
      hashOTP.mockResolvedValue("hash");
      axios.post.mockRejectedValue(new Error("Email service unavailable"));

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Failed to send OTP email. Please try again later."
      });
    });
  });

  describe("OTP generation and hashing", () => {
    beforeEach(() => {
      process.env.EMAIL_SERVICE_URL = "http://localhost:3003";
    });

    it("should generate a 6-digit OTP", async () => {
      // Arrange
      req.body.email = "test@example.com";
      const otp = "123456";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue(otp);
      hashOTP.mockResolvedValue("hash");
      axios.post.mockResolvedValue({ status: 200, data: { success: true } });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(generateOTP).toHaveBeenCalled();
      expect(hashOTP).toHaveBeenCalledWith(otp);
    });

    it("should hash OTP using bcrypt", async () => {
      // Arrange
      req.body.email = "test@example.com";
      const otp = "654321";
      const otpHash = "$2b$10$hashedvalue";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue(otp);
      hashOTP.mockResolvedValue(otpHash);
      axios.post.mockResolvedValue({ status: 200, data: { success: true } });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(hashOTP).toHaveBeenCalledWith(otp);
      expect(EmailVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          otp_hash: otpHash
        })
      );
    });
  });

  describe("Database storage", () => {
    beforeEach(() => {
      process.env.EMAIL_SERVICE_URL = "http://localhost:3003";
    });

    it("should store OTP with correct expiry time (10 minutes)", async () => {
      // Arrange
      req.body.email = "test@example.com";
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(expiresAt);
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue("123456");
      hashOTP.mockResolvedValue("hash");
      axios.post.mockResolvedValue({ status: 200, data: { success: true } });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(EmailVerification.calculateExpiry).toHaveBeenCalled();
      expect(EmailVerification.create).toHaveBeenCalledWith({
        email: "test@example.com",
        otp_hash: "hash",
        expires_at: expiresAt,
        verified: false,
        attempts: 0
      });
    });

    it("should return 500 if database storage fails", async () => {
      // Arrange
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockRejectedValue(new Error("Database error"));
      generateOTP.mockReturnValue("123456");
      hashOTP.mockResolvedValue("hash");

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error"
      });
    });
  });

  describe("Error handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      // Arrange
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error"
      });
    });

    it("should handle OTP generation failure", async () => {
      // Arrange
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      generateOTP.mockImplementation(() => {
        throw new Error("OTP generation failed");
      });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error"
      });
    });

    it("should handle OTP hashing failure", async () => {
      // Arrange
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      generateOTP.mockReturnValue("123456");
      hashOTP.mockRejectedValue(new Error("Hashing failed"));

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error"
      });
    });
  });

  describe("Response format", () => {
    beforeEach(() => {
      process.env.EMAIL_SERVICE_URL = "http://localhost:3003";
    });

    it("should return correct success response format", async () => {
      // Arrange
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue("123456");
      hashOTP.mockResolvedValue("hash");
      axios.post.mockResolvedValue({ status: 200, data: { success: true } });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "OTP sent to your email",
        expiresIn: 600
      });
    });

    it("should return expiresIn as 600 seconds (10 minutes)", async () => {
      // Arrange
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue("123456");
      hashOTP.mockResolvedValue("hash");
      axios.post.mockResolvedValue({ status: 200, data: { success: true } });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresIn: 600
        })
      );
    });
  });

  describe("Requirements compliance", () => {
    beforeEach(() => {
      process.env.EMAIL_SERVICE_URL = "http://localhost:3003";
    });

    it("should comply with Requirement 22.2 - generate 6-digit OTP", async () => {
      // Arrange
      req.body.email = "test@example.com";
      const otp = "123456";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue(otp);
      hashOTP.mockResolvedValue("hash");
      axios.post.mockResolvedValue({ status: 200, data: { success: true } });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert - OTP should be 6 digits
      expect(otp).toMatch(/^\d{6}$/);
    });

    it("should comply with Requirement 22.3 - store OTP in hashed format using bcrypt", async () => {
      // Arrange
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue("123456");
      hashOTP.mockResolvedValue("$2b$10$hash");
      axios.post.mockResolvedValue({ status: 200, data: { success: true } });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert - hashOTP should be called to bcrypt hash the OTP
      expect(hashOTP).toHaveBeenCalledWith("123456");
      expect(EmailVerification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          otp_hash: expect.stringMatching(/^\$2b\$10\$/)
        })
      );
    });

    it("should comply with Requirement 22.4 - set OTP expiry to 10 minutes", async () => {
      // Arrange
      req.body.email = "test@example.com";
      const currentTime = Date.now();
      const expiresAt = new Date(currentTime + 10 * 60 * 1000);

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(expiresAt);
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue("123456");
      hashOTP.mockResolvedValue("hash");
      axios.post.mockResolvedValue({ status: 200, data: { success: true } });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert - expiry should be 10 minutes (600 seconds)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          expiresIn: 600
        })
      );
    });

    it("should comply with Requirement 22.5 - send OTP via email service", async () => {
      // Arrange
      req.body.email = "test@example.com";

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.calculateExpiry = jest.fn().mockReturnValue(new Date());
      EmailVerification.create = jest.fn().mockResolvedValue({});
      generateOTP.mockReturnValue("123456");
      hashOTP.mockResolvedValue("hash");
      axios.post.mockResolvedValue({ status: 200, data: { success: true } });

      // Act
      await publicRequestController.requestOTP(req, res);

      // Assert - email service should be called
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/api/email/sendOTPEmail"),
        expect.objectContaining({
          email: "test@example.com",
          otp: "123456"
        }),
        expect.any(Object)
      );
    });
  });
});


describe("Public Request Controller - verifyOTP", () => {
  let req, res;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      body: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe("Successful OTP verification", () => {
    it("should verify valid OTP and mark email as verified", async () => {
      // Arrange
      const email = "test@example.com";
      const otp = "123456";
      const verification = {
        id: 1,
        email: email,
        otp_hash: "$2b$10$abcdefghijklmnopqrstuvwxyz",
        expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        verified: false,
        attempts: 0
      };

      req.body = { email, otp };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(true);
      EmailVerification.markVerified = jest.fn().mockResolvedValue({ ...verification, verified: true });

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(EmailVerification.validateEmailFormat).toHaveBeenCalledWith(email);
      expect(EmailVerification.findLatestByEmail).toHaveBeenCalledWith(email);
      expect(EmailVerification.isExpired).toHaveBeenCalledWith(verification);
      expect(EmailVerification.verifyOTP).toHaveBeenCalledWith(otp, verification.otp_hash);
      expect(EmailVerification.markVerified).toHaveBeenCalledWith(verification.id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        verified: true,
        message: "Email verified successfully"
      });
    });

    it("should return success if email is already verified", async () => {
      // Arrange
      const email = "test@example.com";
      const otp = "123456";
      const verification = {
        id: 1,
        email: email,
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: true, // Already verified
        attempts: 0
      };

      req.body = { email, otp };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        verified: true,
        message: "Email already verified"
      });
      expect(EmailVerification.verifyOTP).not.toHaveBeenCalled();
    });
  });

  describe("Request validation", () => {
    it("should return 400 if email is missing", async () => {
      // Arrange
      req.body = { otp: "123456" }; // email missing

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Email and OTP are required"
      });
    });

    it("should return 400 if OTP is missing", async () => {
      // Arrange
      req.body = { email: "test@example.com" }; // otp missing

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Email and OTP are required"
      });
    });

    it("should return 400 if email format is invalid", async () => {
      // Arrange
      req.body = { email: "invalid-email", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(false);

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(EmailVerification.validateEmailFormat).toHaveBeenCalledWith("invalid-email");
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid email format"
      });
    });

    it("should return 400 if OTP is not 6 digits", async () => {
      // Arrange
      const invalidOTPs = ["123", "12345", "1234567", "abc123", "12 34 56"];

      for (const otp of invalidOTPs) {
        jest.clearAllMocks();
        req.body = { email: "test@example.com", otp };

        EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);

        // Act
        await publicRequestController.verifyOTP(req, res);

        // Assert
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: "OTP must be a 6-digit number"
        });
      }
    });

    it("should accept 6-digit OTP in various formats (string, number)", async () => {
      // Arrange
      const validOTPs = ["123456", 123456, " 123456 "]; // string, number, with spaces
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 0
      };

      for (const otp of validOTPs) {
        jest.clearAllMocks();
        req.body = { email: "test@example.com", otp };

        EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
        EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
        EmailVerification.isExpired = jest.fn().mockReturnValue(false);
        EmailVerification.verifyOTP = jest.fn().mockResolvedValue(true);
        EmailVerification.markVerified = jest.fn().mockResolvedValue({ ...verification, verified: true });

        // Act
        await publicRequestController.verifyOTP(req, res);

        // Assert - Should be successful
        expect(res.status).toHaveBeenCalledWith(200);
      }
    });
  });

  describe("OTP record retrieval", () => {
    it("should return 401 if no OTP record found for email", async () => {
      // Arrange
      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(null);

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(EmailVerification.findLatestByEmail).toHaveBeenCalledWith("test@example.com");
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid or expired OTP"
      });
    });
  });

  describe("OTP expiry check", () => {
    it("should return 401 if OTP has expired", async () => {
      // Arrange
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (expired)
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(true);

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(EmailVerification.isExpired).toHaveBeenCalledWith(verification);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "OTP has expired. Please request a new OTP."
      });
    });

    it("should verify OTP if within 10-minute validity window", async () => {
      // Arrange
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 3 * 60 * 1000), // 3 minutes remaining
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(true);
      EmailVerification.markVerified = jest.fn().mockResolvedValue({ ...verification, verified: true });

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        verified: true,
        message: "Email verified successfully"
      });
    });
  });

  describe("Maximum attempts check", () => {
    it("should return 429 if attempts already reached 3", async () => {
      // Arrange
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 3 // Max attempts reached
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Maximum verification attempts exceeded. Please request a new OTP."
      });
      expect(EmailVerification.verifyOTP).not.toHaveBeenCalled();
    });

    it("should allow verification if attempts is less than 3", async () => {
      // Arrange
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 2 // 2 failed attempts, still have 1 more
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(true);
      EmailVerification.markVerified = jest.fn().mockResolvedValue({ ...verification, verified: true });

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(EmailVerification.verifyOTP).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe("OTP verification and attempts increment", () => {
    it("should increment attempts on invalid OTP", async () => {
      // Arrange
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "999999" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(false); // Invalid OTP
      EmailVerification.incrementAttempts = jest.fn().mockResolvedValue({ ...verification, attempts: 1 });

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(EmailVerification.incrementAttempts).toHaveBeenCalledWith(verification.id);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid OTP. You have 2 attempt(s) remaining."
      });
    });

    it("should show remaining attempts after each failure", async () => {
      // Test scenarios for different attempt counts
      const scenarios = [
        { attempts: 0, expectedMessage: "Invalid OTP. You have 2 attempt(s) remaining." },
        { attempts: 1, expectedMessage: "Invalid OTP. You have 1 attempt(s) remaining." },
        { attempts: 2, expectedMessage: "Maximum verification attempts exceeded. Please request a new OTP." }
      ];

      for (const scenario of scenarios) {
        jest.clearAllMocks();
        
        const verification = {
          id: 1,
          email: "test@example.com",
          otp_hash: "$2b$10$hash",
          expires_at: new Date(Date.now() + 5 * 60 * 1000),
          verified: false,
          attempts: scenario.attempts
        };

        req.body = { email: "test@example.com", otp: "999999" };

        EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
        EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
        EmailVerification.isExpired = jest.fn().mockReturnValue(false);
        EmailVerification.verifyOTP = jest.fn().mockResolvedValue(false);
        EmailVerification.incrementAttempts = jest.fn().mockResolvedValue({ ...verification, attempts: scenario.attempts + 1 });

        // Act
        await publicRequestController.verifyOTP(req, res);

        // Assert
        if (scenario.attempts === 2) {
          expect(res.status).toHaveBeenCalledWith(429);
        } else {
          expect(res.status).toHaveBeenCalledWith(401);
        }
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: scenario.expectedMessage
        });
      }
    });
  });

  describe("Error handling", () => {
    it("should handle unexpected errors gracefully", async () => {
      // Arrange
      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error"
      });
    });

    it("should handle database errors gracefully", async () => {
      // Arrange
      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockRejectedValue(new Error("Database error"));

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error"
      });
    });

    it("should handle OTP verification errors gracefully", async () => {
      // Arrange
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockRejectedValue(new Error("Verification error"));

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Internal server error"
      });
    });
  });

  describe("Requirements compliance", () => {
    it("should comply with Requirement 22.6 - validate request body (email and OTP)", async () => {
      // Test missing email
      req.body = { otp: "123456" };
      await publicRequestController.verifyOTP(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      // Test missing OTP
      jest.clearAllMocks();
      req.body = { email: "test@example.com" };
      await publicRequestController.verifyOTP(req, res);
      expect(res.status).toHaveBeenCalledWith(400);

      // Test both present
      jest.clearAllMocks();
      req.body = { email: "test@example.com", otp: "123456" };
      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue({
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 0
      });
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(true);
      EmailVerification.markVerified = jest.fn().mockResolvedValue({});
      
      await publicRequestController.verifyOTP(req, res);
      expect(EmailVerification.findLatestByEmail).toHaveBeenCalled();
    });

    it("should comply with Requirement 22.7 - retrieve latest unverified OTP record", async () => {
      // Arrange
      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue({
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 0
      });
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(true);
      EmailVerification.markVerified = jest.fn().mockResolvedValue({});

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert - Should call findLatestByEmail to get the latest record
      expect(EmailVerification.findLatestByEmail).toHaveBeenCalledWith("test@example.com");
    });

    it("should comply with Requirement 22.8 - check expiry (10 minutes)", async () => {
      // Test expired OTP
      const expiredVerification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() - 1000), // Expired
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(expiredVerification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(true);

      await publicRequestController.verifyOTP(req, res);

      // Assert - Should check expiry
      expect(EmailVerification.isExpired).toHaveBeenCalledWith(expiredVerification);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "OTP has expired. Please request a new OTP."
      });
    });

    it("should comply with Requirement 22.9 - check attempts (max 3)", async () => {
      // Test max attempts reached
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 3 // Max reached
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);

      await publicRequestController.verifyOTP(req, res);

      // Assert - Should return 429 when attempts >= 3
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: "Maximum verification attempts exceeded. Please request a new OTP."
      });
    });

    it("should comply with Requirement 22.10 - verify OTP using bcrypt.compare", async () => {
      // Arrange
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(true);
      EmailVerification.markVerified = jest.fn().mockResolvedValue({});

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert - Should call verifyOTP which uses bcrypt.compare internally
      expect(EmailVerification.verifyOTP).toHaveBeenCalledWith("123456", verification.otp_hash);
    });
  });

  describe("Response format", () => {
    it("should return correct success response format", async () => {
      // Arrange
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(true);
      EmailVerification.markVerified = jest.fn().mockResolvedValue({});

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        verified: true,
        message: "Email verified successfully"
      });
    });

    it("should return verified: true in success response", async () => {
      // Arrange
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(true);
      EmailVerification.markVerified = jest.fn().mockResolvedValue({});

      // Act
      await publicRequestController.verifyOTP(req, res);

      // Assert
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          verified: true
        })
      );
    });
  });

  describe("HTTP status codes", () => {
    it("should return 400 Bad Request for validation errors", async () => {
      req.body = { email: "test@example.com" }; // Missing OTP
      await publicRequestController.verifyOTP(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should return 401 Unauthorized for OTP mismatch", async () => {
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "999999" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);
      EmailVerification.verifyOTP = jest.fn().mockResolvedValue(false);
      EmailVerification.incrementAttempts = jest.fn().mockResolvedValue({});

      await publicRequestController.verifyOTP(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 401 Unauthorized for expired OTP", async () => {
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() - 1000),
        verified: false,
        attempts: 0
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(true);

      await publicRequestController.verifyOTP(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("should return 429 Too Many Requests for max attempts exceeded", async () => {
      const verification = {
        id: 1,
        email: "test@example.com",
        otp_hash: "$2b$10$hash",
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
        verified: false,
        attempts: 3
      };

      req.body = { email: "test@example.com", otp: "123456" };

      EmailVerification.validateEmailFormat = jest.fn().mockReturnValue(true);
      EmailVerification.findLatestByEmail = jest.fn().mockResolvedValue(verification);
      EmailVerification.isExpired = jest.fn().mockReturnValue(false);

      await publicRequestController.verifyOTP(req, res);
      expect(res.status).toHaveBeenCalledWith(429);
    });
  });
});
