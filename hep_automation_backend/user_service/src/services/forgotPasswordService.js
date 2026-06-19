const crypto = require("crypto");
const redisClient = require("../../config/redisClient");

const OTP_EXPIRY = 300;
const MAX_ATTEMPTS = 3;

const generateOtp = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const saveOtp = async (
  identifier,
  otp,
  existingData = null
) => {

  const key =
    `FORGOT_PASSWORD:${identifier}`;

  const payload =
    existingData || {
      otp,
      attempts: 0,
      verified: false
    };

  console.log(
    "REDIS SAVE PAYLOAD:",
    payload
  );

  await redisClient.set(
    key,
    JSON.stringify(payload),
    {
      EX: OTP_EXPIRY
    }
  );

};

const getOtp = async (identifier) => {
  const key = `FORGOT_PASSWORD:${identifier}`;

  const data = await redisClient.get(key);

  return data ? JSON.parse(data) : null;
};

const deleteOtp = async (identifier) => {
  const key = `FORGOT_PASSWORD:${identifier}`;

  await redisClient.del(key);
};

const RESEND_COOLDOWN = 60;

const canSendOtp = async (identifier) => {

  const key =
    `FORGOT_PASSWORD_COOLDOWN:${identifier}`;

  const exists =
    await redisClient.exists(key);

  return !exists;

};

const setCooldown = async (
  identifier
) => {

  const key =
    `FORGOT_PASSWORD_COOLDOWN:${identifier}`;

  await redisClient.set(
    key,
    "1",
    {
      EX: RESEND_COOLDOWN
    }
  );

};

const MAX_OTP_PER_HOUR = 5;

const incrementOtpCounter =
  async (identifier) => {

    const key =
      `FORGOT_PASSWORD_COUNT:${identifier}`;

    const count =
      await redisClient.incr(key);

    if (count === 1) {

      await redisClient.expire(
        key,
        3600
      );

    }

    return count;

};

module.exports = {
  generateOtp,
  saveOtp,
  getOtp,
  deleteOtp,
  MAX_ATTEMPTS,
  canSendOtp,
  setCooldown,
  incrementOtpCounter,
};
