const redisClient = require("../../config/redisClient");

/**
 * Rate Limiting Middleware for Multiple Pass Submissions Feature
 * 
 * Implements Redis-based rate limiting for:
 * - OTP requests (per email and per IP)
 * - CAPTCHA verification attempts (per IP)
 * - Public request submissions (per email and per IP)
 * 
 * Requirements: 22.12, 22.13, 23.11, 19.1, 31.1-31.5
 */

/**
 * Check OTP rate limits
 * Rules:
 * - 1 OTP request per minute per email
 * - 5 OTP requests per hour per email
 * - 20 OTP requests per hour per IP
 * 
 * @param {string} email - The email address requesting OTP
 * @param {string} ipAddress - The IP address of the requester
 * @returns {Promise<{allowed: boolean, retryAfter?: number, message?: string}>}
 */
async function checkOTPRateLimit(email, ipAddress) {
  try {
    // In development mode, allow rapid testing without rate-limiting blocks
    if (process.env.NODE_ENV === "development") {
      return { allowed: true };
    }

    const emailMinuteKey = `ratelimit:otp:email:minute:${email}`;
    const emailHourKey = `ratelimit:otp:email:hour:${email}`;
    const ipHourKey = `ratelimit:otp:ip:hour:${ipAddress}`;

    // Check 1 per minute per email
    const emailMinuteCount = await redisClient.get(emailMinuteKey);
    if (emailMinuteCount && parseInt(emailMinuteCount) >= 1) {
      const ttl = await redisClient.ttl(emailMinuteKey);
      return {
        allowed: false,
        retryAfter: ttl > 0 ? ttl : 60,
        message: `Too many OTP requests. Please try again after ${ttl > 0 ? ttl : 60} seconds.`
      };
    }

    // Check 5 per hour per email
    const emailHourCount = await redisClient.get(emailHourKey);
    if (emailHourCount && parseInt(emailHourCount) >= 5) {
      const ttl = await redisClient.ttl(emailHourKey);
      return {
        allowed: false,
        retryAfter: ttl > 0 ? ttl : 3600,
        message: `Too many OTP requests for this email. Please try again after ${Math.ceil((ttl > 0 ? ttl : 3600) / 60)} minutes.`
      };
    }

    // Check 20 per hour per IP
    const ipHourCount = await redisClient.get(ipHourKey);
    if (ipHourCount && parseInt(ipHourCount) >= 20) {
      const ttl = await redisClient.ttl(ipHourKey);
      return {
        allowed: false,
        retryAfter: ttl > 0 ? ttl : 3600,
        message: `Too many OTP requests from this IP address. Please try again later.`
      };
    }

    // Increment counters
    const emailMinuteCurrent = emailMinuteCount ? parseInt(emailMinuteCount) : 0;
    const emailHourCurrent = emailHourCount ? parseInt(emailHourCount) : 0;
    const ipHourCurrent = ipHourCount ? parseInt(ipHourCount) : 0;

    await redisClient.setEx(emailMinuteKey, 60, (emailMinuteCurrent + 1).toString());
    await redisClient.setEx(emailHourKey, 3600, (emailHourCurrent + 1).toString());
    await redisClient.setEx(ipHourKey, 3600, (ipHourCurrent + 1).toString());

    return { allowed: true };
  } catch (error) {
    console.error("Error checking OTP rate limit:", error);
    // Fail open - allow request if Redis is unavailable
    return { allowed: true };
  }
}

/**
 * Check CAPTCHA rate limits
 * Rules:
 * - 10 failed attempts per 15 minutes per IP
 * - Block IP for 1 hour after 10 failed attempts
 * 
 * @param {string} ipAddress - The IP address of the requester
 * @returns {Promise<{allowed: boolean, retryAfter?: number, message?: string}>}
 */
async function checkCAPTCHARateLimit(ipAddress) {
  try {
    const blockKey = `ratelimit:captcha:block:${ipAddress}`;
    const failureKey = `ratelimit:captcha:failures:${ipAddress}`;

    // Check if IP is blocked
    const isBlocked = await redisClient.get(blockKey);
    if (isBlocked) {
      const ttl = await redisClient.ttl(blockKey);
      return {
        allowed: false,
        retryAfter: ttl > 0 ? ttl : 3600,
        message: `Your IP has been temporarily blocked due to too many failed CAPTCHA attempts. Please try again after ${Math.ceil((ttl > 0 ? ttl : 3600) / 60)} minutes.`
      };
    }

    // Check failure count (10 failures in 15 minutes)
    const failureCount = await redisClient.get(failureKey);
    if (failureCount && parseInt(failureCount) >= 10) {
      // Block the IP for 1 hour
      await redisClient.setEx(blockKey, 3600, "1");
      await redisClient.del(failureKey);
      
      return {
        allowed: false,
        retryAfter: 3600,
        message: "Too many failed CAPTCHA attempts. Your IP has been blocked for 1 hour."
      };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Error checking CAPTCHA rate limit:", error);
    // Fail open - allow request if Redis is unavailable
    return { allowed: true };
  }
}

/**
 * Record a CAPTCHA failure
 * Increments the failure counter for the IP address
 * 
 * @param {string} ipAddress - The IP address that failed CAPTCHA
 * @returns {Promise<void>}
 */
async function recordCAPTCHAFailure(ipAddress) {
  try {
    const failureKey = `ratelimit:captcha:failures:${ipAddress}`;
    
    const failureCount = await redisClient.get(failureKey);
    const currentCount = failureCount ? parseInt(failureCount) : 0;
    
    // Set with 15-minute expiry
    await redisClient.setEx(failureKey, 900, (currentCount + 1).toString());
  } catch (error) {
    console.error("Error recording CAPTCHA failure:", error);
  }
}

/**
 * Check public request rate limits
 * Rules:
 * - 10 requests per 24 hours per email
 * - 5 requests per hour per IP
 * 
 * @param {string} email - The email address submitting the request
 * @param {string} ipAddress - The IP address of the requester
 * @returns {Promise<{allowed: boolean, retryAfter?: number, message?: string}>}
 */
async function checkPublicRequestRateLimit(email, ipAddress) {
  try {
    const MAX_EMAIL_PER_DAY = 10;
    const emailDayKey = `ratelimit:publicrequest:email:day:${email}`;
    const ipHourKey = `ratelimit:publicrequest:ip:hour:${ipAddress}`;

    // Check 10 per 24 hours per email
    const emailDayCount = await redisClient.get(emailDayKey);
    if (emailDayCount && parseInt(emailDayCount) >= MAX_EMAIL_PER_DAY) {
      const ttl = await redisClient.ttl(emailDayKey);
      return {
        allowed: false,
        retryAfter: ttl > 0 ? ttl : 86400,
        message: `You have reached the maximum of ${MAX_EMAIL_PER_DAY} submissions per 24 hours from this email address. Please wait ${Math.ceil((ttl > 0 ? ttl : 86400) / 3600)} hours before submitting another request.`
      };
    }

    // Check 5 per hour per IP
    const ipHourCount = await redisClient.get(ipHourKey);
    if (ipHourCount && parseInt(ipHourCount) >= 5) {
      const ttl = await redisClient.ttl(ipHourKey);
      return {
        allowed: false,
        retryAfter: ttl > 0 ? ttl : 3600,
        message: `Too many requests from this IP address. Please try again after ${Math.ceil((ttl > 0 ? ttl : 3600) / 60)} minutes.`
      };
    }

    // Increment counters
    const emailDayCurrent = emailDayCount ? parseInt(emailDayCount) : 0;
    const ipHourCurrent = ipHourCount ? parseInt(ipHourCount) : 0;

    await redisClient.setEx(emailDayKey, 86400, (emailDayCurrent + 1).toString());
    await redisClient.setEx(ipHourKey, 3600, (ipHourCurrent + 1).toString());

    return { allowed: true };
  } catch (error) {
    console.error("Error checking public request rate limit:", error);
    // Fail open - allow request if Redis is unavailable
    return { allowed: true };
  }
}

/**
 * Express middleware wrapper for OTP rate limiting
 * Extracts email from request body and IP from request
 */
const otpRateLimiter = async (req, res, next) => {
  try {
    const email = req.body.email;
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const result = await checkOTPRateLimit(email, ipAddress);

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        message: result.message,
        retryAfter: result.retryAfter
      });
    }

    next();
  } catch (error) {
    console.error("OTP rate limiter error:", error);
    next(); // Fail open
  }
};

/**
 * Express middleware wrapper for CAPTCHA rate limiting
 * Extracts IP from request
 */
const captchaRateLimiter = async (req, res, next) => {
  try {
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];

    const result = await checkCAPTCHARateLimit(ipAddress);

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        message: result.message,
        retryAfter: result.retryAfter
      });
    }

    next();
  } catch (error) {
    console.error("CAPTCHA rate limiter error:", error);
    next(); // Fail open
  }
};

/**
 * Express middleware wrapper for public request rate limiting
 * Extracts email from request body and IP from request
 */
const publicRequestRateLimiter = async (req, res, next) => {
  try {
    const email = req.body.applicantEmail || req.body.email;
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const result = await checkPublicRequestRateLimit(email, ipAddress);

    if (!result.allowed) {
      return res.status(429).json({
        success: false,
        message: result.message,
        retryAfter: result.retryAfter
      });
    }

    next();
  } catch (error) {
    console.error("Public request rate limiter error:", error);
    next(); // Fail open
  }
};

module.exports = {
  checkOTPRateLimit,
  checkCAPTCHARateLimit,
  checkPublicRequestRateLimit,
  recordCAPTCHAFailure,
  otpRateLimiter,
  captchaRateLimiter,
  publicRequestRateLimiter
};
