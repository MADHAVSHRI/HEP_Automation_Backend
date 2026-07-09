const { WeighbridgeRecord } = require("../../models");
const { MOVEMENT_TYPE_LIST, WEIGHT_UNIT_LIST } = require("../constants/constants");

const REQUIRED_FIELDS = [
  "weighBridgeName",
  "serialNo",
  "weighedAt",
  "vehicleNumber",
  "movementType",
  "cargo",
  "clientName",
  "grossWeight",
  "tareWeight",
  "netWeight",
  "weightUnit",
];

// Receives the weighbridge data shared by APAC (Weighbridge Operator approval)
// and persists it for the Iportman gate automation system.
exports.createWeighbridgeRecord = async (req, res) => {
  try {
    const {
      weighBridgeName,
      serialNo,
      weighedAt,
      vehicleNumber,
      movementType,
      cargo,
      clientName,
      grossWeight,
      tareWeight,
      netWeight,
      weightUnit,
    } = req.body;

    const missing = REQUIRED_FIELDS.filter(
      (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === "",
    );
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    if (!MOVEMENT_TYPE_LIST.includes(movementType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid movementType. Allowed values: ${MOVEMENT_TYPE_LIST.join(", ")}`,
      });
    }

    if (!WEIGHT_UNIT_LIST.includes(weightUnit)) {
      return res.status(400).json({
        success: false,
        message: `Invalid weightUnit. Allowed values: ${WEIGHT_UNIT_LIST.join(", ")}`,
      });
    }

    const existing = await WeighbridgeRecord.findOne({ where: { serialNo } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Weighbridge record with serial number '${serialNo}' already exists`,
        data: existing,
      });
    }

    const record = await WeighbridgeRecord.create({
      weighBridgeName,
      serialNo,
      weighedAt,
      vehicleNumber,
      movementType,
      cargo,
      clientName,
      grossWeight,
      tareWeight,
      netWeight,
      weightUnit,
    });

    return res.status(201).json({
      success: true,
      message: "Weighbridge record saved successfully",
      data: record,
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: `Weighbridge record with serial number '${req.body.serialNo}' already exists`,
      });
    }
    console.error("Error creating weighbridge record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getWeighbridgeRecords = async (req, res) => {
  try {
    const records = await WeighbridgeRecord.findAll({
      order: [["weighedAt", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      count: records.length,
      data: records,
    });
  } catch (error) {
    console.error("Error fetching weighbridge records:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.getWeighbridgeRecordById = async (req, res) => {
  try {
    const record = await WeighbridgeRecord.findByPk(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Weighbridge record not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    console.error("Error fetching weighbridge record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
