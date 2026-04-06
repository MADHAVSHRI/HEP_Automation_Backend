const jwt = require("jsonwebtoken");

const getEnv = (name) => {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return val;
};

const generateAccessToken = (payload) => {
  return jwt.sign(payload, getEnv("JWT_SECRET"), { expiresIn: "15m" });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, getEnv("JWT_REFRESH_SECRET"), { expiresIn: "7d" });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
