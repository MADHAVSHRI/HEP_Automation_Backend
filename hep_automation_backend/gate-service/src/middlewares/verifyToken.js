/**
 * verifyToken.js — gate-service
 *
 * Verifies the auth-service access token and attaches its claims to req.user.
 * Mirrors auth-service/src/middlewares/verifyToken.js; the same JWT_SECRET is
 * shared, so officers are not asked to log in again for this service.
 */

const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Token missing",
    });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader.split(" ")[1];

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({
      success: false,
      message: "Server misconfiguration: JWT secret not set",
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);

    if (typeof decoded === "string" || decoded === null) {
      return res.status(401).json({
        success: false,
        message: "Invalid token payload",
      });
    }

    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }
};
