const express = require("express");
const router = express.Router();
const captchaController = require("../controllers/captchaController");
const captchaLimiter = require( "../middlewares/rateLimiter" );

router.get("/get-captcha", captchaLimiter, captchaController.getCaptcha);

module.exports = router;