// const redisClient = require("../../config/redisClient");
// const generateCaptcha = require("../utils/captchaGenerator");
// const crypto = require("crypto");

// const CAPTCHA_EXPIRY = Number(process.env.CAPTCHA_EXPIRY ?? 120);

// exports.createCaptcha = async () => {
//   const captcha = generateCaptcha();

//   const token = crypto.randomUUID();

//   await redisClient.setEx(
//     `captcha:${token}`,
//     CAPTCHA_EXPIRY,
//     captcha.text
//   );

//   return {
//     captchaQuestion: captcha.question,
//     captchaToken: token,
//     expiresIn: CAPTCHA_EXPIRY,
//   };
// };

// exports.verifyCaptcha = async (token, value) => {
//   const stored = await redisClient.get(`captcha:${token}`);

//   if (!stored) {
//     return false;
//   }

//   const isValid =
//     Number(stored) === Number(value);

//   if (!isValid) {
//     return false;
//   }

//   await redisClient.del(`captcha:${token}`);

//   return true;
// };

const redisClient = require("../../config/redisClient");
const generateCaptcha = require("../utils/captchaGenerator");
const crypto = require("crypto");

const CAPTCHA_EXPIRY = Number(process.env.CAPTCHA_EXPIRY ?? 120);

exports.createCaptcha = async () => {
  const captcha = generateCaptcha();

  const token = crypto.randomUUID();

  // store answer in redis
  await redisClient.setEx(`captcha:${token}`, CAPTCHA_EXPIRY, captcha.text);

  return {
    captchaQuestion: captcha.question, // ✅ IMPORTANT
    captchaToken: token,
    expiresIn: CAPTCHA_EXPIRY,
  };
};

exports.verifyCaptcha = async (token, value) => {
  const stored = await redisClient.get(`captcha:${token}`);

  if (!stored) {
    return false;
  }

  const isValid = Number(stored) === Number(value);

  if (!isValid) {
    return false;
  }

  // delete after successful verification
  await redisClient.del(`captcha:${token}`);

  return true;
};

// exports.createCaptcha = async () => {
//   const captcha = generateCaptcha();

//   const token = crypto.randomUUID();

//   await redisClient.setEx(`captcha:${token}`, CAPTCHA_EXPIRY, captcha.text);

//   return {
//     captchaSvg: captcha.svg,
//     captchaToken: token,
//     expiresIn: CAPTCHA_EXPIRY,
//   };
// };

// exports.verifyCaptcha = async (token, value) => {
//   const stored = await redisClient.get(`captcha:${token}`);

//   if (!stored) return false;

//   if (stored.toLowerCase() !== value.toLowerCase()) {
//     return false;
//   }

//   await redisClient.del(`captcha:${token}`);

//   return true;
// };
