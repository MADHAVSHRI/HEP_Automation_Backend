const { verifyToken } = require("../utils/jwt");
const { CustomsOperator } = require("../../models");

const customsAuth = async (req, res, next) => {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: missing bearer token",
    });
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized: invalid or expired token",
    });
  }

  try {
    const operator = await CustomsOperator.findByPk(decoded.id);

    if (!operator) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: operator no longer exists",
      });
    }

    if (!operator.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    req.operator = operator;
    next();
  } catch (error) {
    console.error("Error verifying Customs operator:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = customsAuth;