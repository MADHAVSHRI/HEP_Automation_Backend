const bcrypt = require("bcrypt");
const { WeighbridgeOperator } = require("../../models");
const generateLoginId = require("../utils/generateLoginId");
const { signToken } = require("../utils/jwt");

const SALT_ROUNDS = 10;
const REQUIRED_FIELDS = ["weighBridgeName", "password"];

// Generates a unique 8-digit login id, retrying on the rare collision.
async function generateUniqueLoginId() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const loginId = generateLoginId();
    const exists = await WeighbridgeOperator.findOne({ where: { loginId } });
    if (!exists) return loginId;
  }
  throw new Error("Could not generate a unique login id");
}

// Creates a weighbridge operator account. Password is hashed; an 8-digit
// login id is generated and returned so the operator can sign in.
exports.createOperator = async (req, res) => {
  try {
    const { weighBridgeName, password } = req.body;

    const missing = REQUIRED_FIELDS.filter(
      (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === "",
    );
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const loginId = await generateUniqueLoginId();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const operator = await WeighbridgeOperator.create({
      loginId,
      weighBridgeName,
      password: hashedPassword,
    });

    // defaultScope excludes password, so operator.toJSON() is already safe.
    return res.status(201).json({
      success: true,
      message: "Weighbridge operator created successfully",
      data: {
        id: operator.id,
        loginId: operator.loginId,
        weighBridgeName: operator.weighBridgeName,
        isActive: operator.isActive,
      },
    });
  } catch (error) {
    console.error("Error creating weighbridge operator:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Authenticates an operator by loginId + password and returns a JWT.
exports.loginOperator = async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: "loginId and password are required",
      });
    }

    const operator = await WeighbridgeOperator.scope("withPassword").findOne({
      where: { loginId },
    });

    // Same generic message whether the id is unknown or the password is wrong.
    if (!operator || !(await bcrypt.compare(password, operator.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid login id or password",
      });
    }

    if (!operator.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is inactive",
      });
    }

    const token = signToken({
      id: operator.id,
      loginId: operator.loginId,
      weighBridgeName: operator.weighBridgeName,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        id: operator.id,
        loginId: operator.loginId,
        weighBridgeName: operator.weighBridgeName,
      },
    });
  } catch (error) {
    console.error("Error logging in weighbridge operator:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Returns the authenticated operator's profile (JWT-protected).
// operatorAuth already loaded and verified the operator.
exports.getProfile = (req, res) => {
  return res.status(200).json({ success: true, data: req.operator });
};
