const { rateLimit } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const redisClient = require("../../config/redisClient");

const forgotPasswordLimiter = rateLimit({

  windowMs: 15 * 60 * 1000, // 15 minutes

  max: 5, // max 5 OTP requests

  standardHeaders: true,

  legacyHeaders: false,

  message: {
    success: false,
    message:
      "Too many OTP requests. Please try again after 15 minutes."
  },

  store: new RedisStore({
    sendCommand: (...args) =>
      redisClient.sendCommand(args),
  }),

});

module.exports = forgotPasswordLimiter;