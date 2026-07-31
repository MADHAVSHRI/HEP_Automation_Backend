/**
 * forgotPasswordLimiter.js
 *
 * Rate-limits the /api/auth/forgot-password proxy endpoint.
 * Mirrors the limit already applied in user_service for the agent flow.
 *
 * Limit: 5 requests per 15-minute window, keyed by IP address.
 * Backed by Redis so the counter survives process restarts.
 *
 * VAPT fix: Vuln #8 – Missing rate limiting on password reset (A07 / CWE-799)
 */
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redisClient = require("../config/redisClient");

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // max 5 OTP requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.log("Forgot password limiter triggered");
    return res.status(429).json({
      success: false,
      message: "Too many OTP requests. Please try again after 15 minutes.",
    });
  },
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),
});

module.exports = forgotPasswordLimiter;
