/**
 * forgotPasswordLimiter.js
 *
 * Rate-limits the POST /api/user/forgot-password endpoint in the
 * approval-admin-service to prevent OTP flooding / automated abuse.
 *
 * Limit: 5 requests per 15-minute window, keyed by IP address.
 * Backed by Redis for persistence across restarts.
 *
 * VAPT fix: Vuln #8 – Missing rate limiting on password reset (A07 / CWE-799)
 *
 * NOTE: approval-admin-service uses redis@6 which has a slightly different
 * client API (legacyMode) compared to user_service's redis@4+. We use the
 * same express-rate-limit + rate-limit-redis approach but call sendCommand
 * on the underlying v4-compat client.
 */
const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redisClient = require("../../config/redisClient");

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // max 5 OTP requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again after 15 minutes.",
  },
  store: new RedisStore({
    // redis@6 legacyMode: use v4 interface via .v4 property
    sendCommand: (...args) => {
      const client = redisClient.v4 || redisClient;
      return client.sendCommand(args);
    },
  }),
});

module.exports = forgotPasswordLimiter;
