const jwt = require("jsonwebtoken");

const getEnv = (name) => {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return val;
};

const generateAccessToken = (payload) => {
  return jwt.sign(payload, getEnv("JWT_SECRET"), { expiresIn: "30s" });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, getEnv("JWT_REFRESH_SECRET"), { expiresIn: "5m" });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
};
