const bcrypt = require("bcrypt");
const { WeighbridgeOperator, WeighbridgeRecord } = require("../../models");
const generateLoginId = require("../utils/generateLoginId");
const { signToken } = require("../utils/jwt");

const SALT_ROUNDS = 10;
const REQUIRED_FIELDS = ["weighBridgeName", "password"];
const OPTIONAL_FIELDS = [
  "email1",
  "email2",
  "contactPerson1",
  "contactPersonDesignation1",
  "contactPersonPhone1",
  "contactPerson2",
  "contactPersonDesignation2",
  "contactPersonPhone2",
  "location",
  "address",
  "telNo",
  "faxNo",
  "cargoType",
];

// cargoType is optional, but when given it must be one of the allowed values.
function invalidCargoType(value) {
  return value !== undefined && value !== null && !WeighbridgeOperator.CARGO_TYPES.includes(value);
}

const cargoTypeError = (res) =>
  res.status(400).json({
    success: false,
    message: `cargoType must be one of: ${WeighbridgeOperator.CARGO_TYPES.join(", ")}`,
  });

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

    if (invalidCargoType(req.body.cargoType)) return cargoTypeError(res);

    const details = {};
    for (const field of OPTIONAL_FIELDS) {
      if (req.body[field] !== undefined) details[field] = req.body[field];
    }

    const loginId = await generateUniqueLoginId();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const operator = await WeighbridgeOperator.create({
      loginId,
      weighBridgeName,
      password: hashedPassword,
      ...details,
    });

    // Code is derived from the auto-increment id, so it is always unique.
    await operator.update({
      weighbridgeCode: `WB${String(operator.id).padStart(3, "0")}`,
    });

    const { password: _password, ...data } = operator.toJSON();

    return res.status(201).json({
      success: true,
      message: "Weighbridge operator created successfully",
      data,
    });
  } catch (error) {
    console.error("Error creating weighbridge operator:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Returns all weighbridge operators. defaultScope excludes password.
exports.getAllOperators = async (req, res) => {
  try {
    const operators = await WeighbridgeOperator.findAll({
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: operators.length,
      data: operators,
    });
  } catch (error) {
    console.error("Error fetching weighbridge operators:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Partially updates an operator: only fields present in the body change.
// loginId, password and weighbridgeCode are not editable here.
const EDITABLE_FIELDS = ["weighBridgeName", "isActive", ...OPTIONAL_FIELDS];

exports.updateOperator = async (req, res) => {
  try {
    const operator = await WeighbridgeOperator.findByPk(req.params.id);
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: "Weighbridge operator not found",
      });
    }

    const updates = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: `No editable fields provided. Allowed: ${EDITABLE_FIELDS.join(", ")}`,
      });
    }

    if (updates.weighBridgeName === null || updates.weighBridgeName === "") {
      return res.status(400).json({
        success: false,
        message: "weighBridgeName cannot be empty",
      });
    }

    if (invalidCargoType(updates.cargoType)) return cargoTypeError(res);

    await operator.update(updates);

    return res.status(200).json({
      success: true,
      message: "Weighbridge operator updated successfully",
      data: operator,
    });
  } catch (error) {
    console.error("Error updating weighbridge operator:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Permanently deletes an operator. Refused when weighbridge records reference
// it (FK is ON DELETE RESTRICT) — deactivate with isActive=false instead.
exports.deleteOperator = async (req, res) => {
  try {
    const operator = await WeighbridgeOperator.findByPk(req.params.id);
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: "Weighbridge operator not found",
      });
    }

    const recordCount = await WeighbridgeRecord.count({
      where: { operatorId: operator.id },
    });
    if (recordCount) {
      return res.status(409).json({
        success: false,
        message: `Operator has ${recordCount} weighbridge record(s) and cannot be deleted. Set isActive to false instead.`,
      });
    }

    await operator.destroy();

    return res.status(200).json({
      success: true,
      message: "Weighbridge operator deleted successfully",
      data: { id: operator.id, loginId: operator.loginId },
    });
  } catch (error) {
    console.error("Error deleting weighbridge operator:", error);
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
