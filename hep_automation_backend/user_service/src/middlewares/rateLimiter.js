const {rateLimit} = require("express-rate-limit");
const {RedisStore} = require("rate-limit-redis");
const redisClient = require("../../config/redisClient");

const captchaLimiter = rateLimit({

  windowMs: 60 * 1000,

  max: 100,

  standardHeaders: true,

  legacyHeaders: false,

  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }),

});

module.exports = captchaLimiter;