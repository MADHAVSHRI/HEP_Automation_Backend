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

module.exports = {
  generateOtp,
  saveOtp,
  getOtp,
  deleteOtp,
  MAX_ATTEMPTS,
};
