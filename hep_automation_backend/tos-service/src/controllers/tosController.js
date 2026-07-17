const bcrypt = require("bcrypt");
const {
  TosOperator,
  TosForm13,
  TosForm13Container,
  TosEirRecord,
  sequelize,
} = require("../../models");
const { signToken } = require("../utils/jwt");
const {
  TERMINAL_LIST,
  MOVEMENT_TYPE_LIST,
  FULL_EMPTY_LIST,
  YES_NO_LIST,
} = require("../constants/constants");

const EIR_REQUIRED_FIELDS = [
  "eirNo",
  "terminal",
  "inGateDateTime",
  "outGateDateTime",
  "containerNumber",
  "containerISO",
  "containerSize",
  "movementType",
  "fullEmpty",
  "line",
  "trailerNumber",
  "oocStatus",
  "destinationGroup",
  "destinationName",
  "markedForScanning",
];

exports.login = async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: "loginId and password are required",
      });
    }

    const operator = await TosOperator.scope("withPassword").findOne({
      where: { loginId },
    });

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
      terminal: operator.terminal,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: {
        loginId: operator.loginId,
        terminal: operator.terminal,
      },
    });
  } catch (error) {
    console.error("Error logging in TOS operator:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

function validateForm13Payload(payload) {
  const errors = [];
  const { form13No, terminal, trailerNumber, containers } = payload;

  if (!form13No) errors.push("form13No is required");
  if (!terminal) errors.push("terminal is required");
  if (!trailerNumber) errors.push("trailerNumber is required");

  if (terminal && !TERMINAL_LIST.includes(terminal)) {
    errors.push(`Invalid terminal. Allowed values: ${TERMINAL_LIST.join(", ")}`);
  }

  if (!Array.isArray(containers) || containers.length === 0) {
    errors.push("containers is required and must be a non-empty array");
    return errors;
  }

  if (containers.length > 4) {
    errors.push("maximum 4 container objects are allowed");
  }

  const exportContainers = containers.filter((item) => item.movementType === "Export");
  const importContainers = containers.filter((item) => item.movementType === "Import");

  if (exportContainers.length > 2) {
    errors.push("maximum 2 Export containers are allowed");
  }

  if (importContainers.length > 2) {
    errors.push("maximum 2 Import containers are allowed");
  }

  containers.forEach((item, index) => {
    if (!MOVEMENT_TYPE_LIST.includes(item.movementType)) {
      errors.push(
        `containers[${index}].movementType is invalid. Allowed values: ${MOVEMENT_TYPE_LIST.join(", ")}`,
      );
      return;
    }

    if (item.movementType === "Export") {
      if (!item.containerNumber) {
        errors.push(`containers[${index}].containerNumber is required for Export`);
      }
      if (!item.containerISO) {
        errors.push(`containers[${index}].containerISO is required for Export`);
      }
      if (!item.containerSize) {
        errors.push(`containers[${index}].containerSize is required for Export`);
      }
    }
  });

  return errors;
}

exports.pushForm13 = async (req, res) => {
  try {
    const validationErrors = validateForm13Payload(req.body);

    if (validationErrors.length) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join("; "),
      });
    }

    const { form13No, terminal, trailerNumber, containers } = req.body;

    const existing = await TosForm13.findOne({ where: { form13No } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Form-13 record with number '${form13No}' already exists`,
      });
    }

    const transaction = await sequelize.transaction();

    try {
      const form13 = await TosForm13.create(
        {
          form13No,
          terminal,
          trailerNumber,
          createdBy: req.operator.id,
        },
        { transaction },
      );

      const rows = containers.map((item) => ({
        form13Id: form13.id,
        containerNumber: item.containerNumber || null,
        containerSize: item.containerSize || null,
        containerISO: item.containerISO || null,
        containerType: item.containerType || null,
        movementType: item.movementType,
      }));

      await TosForm13Container.bulkCreate(rows, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Form-13 record saved successfully",
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: `Form-13 record with number '${req.body.form13No}' already exists`,
      });
    }

    console.error("Error saving Form-13 record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

exports.pushEir = async (req, res) => {
  try {
    const missing = EIR_REQUIRED_FIELDS.filter(
      (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === "",
    );

    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    const {
      eirNo,
      terminal,
      inGateDateTime,
      outGateDateTime,
      containerNumber,
      containerISO,
      containerSize,
      movementType,
      fullEmpty,
      line,
      trailerNumber,
      oocStatus,
      destinationGroup,
      destinationName,
      markedForScanning,
    } = req.body;

    if (!TERMINAL_LIST.includes(terminal)) {
      return res.status(400).json({
        success: false,
        message: `Invalid terminal. Allowed values: ${TERMINAL_LIST.join(", ")}`,
      });
    }

    if (!MOVEMENT_TYPE_LIST.includes(movementType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid movementType. Allowed values: ${MOVEMENT_TYPE_LIST.join(", ")}`,
      });
    }

    if (!FULL_EMPTY_LIST.includes(fullEmpty)) {
      return res.status(400).json({
        success: false,
        message: `Invalid fullEmpty. Allowed values: ${FULL_EMPTY_LIST.join(", ")}`,
      });
    }

    if (!YES_NO_LIST.includes(oocStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid oocStatus. Allowed values: ${YES_NO_LIST.join(", ")}`,
      });
    }

    if (!YES_NO_LIST.includes(markedForScanning)) {
      return res.status(400).json({
        success: false,
        message: `Invalid markedForScanning. Allowed values: ${YES_NO_LIST.join(", ")}`,
      });
    }

    const existing = await TosEirRecord.findOne({ where: { eirNo } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `EIR record with number '${eirNo}' already exists`,
      });
    }

    await TosEirRecord.create({
      eirNo,
      terminal,
      inGateDateTime,
      outGateDateTime,
      containerNumber,
      containerISO,
      containerSize,
      movementType,
      fullEmpty,
      line,
      trailerNumber,
      oocStatus,
      destinationGroup,
      destinationName,
      markedForScanning,
      createdBy: req.operator.id,
    });

    return res.status(201).json({
      success: true,
      message: "EIR record saved successfully",
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: `EIR record with number '${req.body.eirNo}' already exists`,
      });
    }

    console.error("Error saving EIR record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
