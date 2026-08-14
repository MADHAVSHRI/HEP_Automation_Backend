const bcrypt = require("bcrypt");
const {
  CustomsOperator,
  CustomsExamination,
  CustomsRapiscan,
  CustomsOoc,
  sequelize,
} = require("../../models");
const { signToken } = require("../utils/jwt");
const {
  DISCREPANCY_FOUND_LIST,
  SCANNING_STATUS_LIST,
} = require("../constants/constants");

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

exports.login = async (req, res) => {
  try {
    const { loginId, password } = req.body;

    if (!loginId || !password) {
      return res.status(400).json({
        success: false,
        message: "loginId and password are required",
      });
    }

    const operator = await CustomsOperator.scope("withPassword").findOne({
      where: { loginId },
    });

    if (!operator || !(await bcrypt.compare(password, operator.password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid login ID or password",
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
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (error) {
    console.error("Error logging in Customs operator:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ---------------------------------------------------------------------------
// Rapiscan Push
// ---------------------------------------------------------------------------

// YYYY-MM-DDTHH:MM:SS (no timezone required per spec)
const RAPISCAN_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const RAPISCAN_REQUIRED_FIELDS = [
  "containerNumber",
  "containerSize",
  "scanningStatus",
  "scanningDateTime",
];

function validateRapiscanPayload(payload) {
  const errors = [];

  // Required-field presence check
  for (const field of RAPISCAN_REQUIRED_FIELDS) {
    if (!payload[field] || payload[field].toString().trim() === "") {
      errors.push(`${field} is required`);
    }
  }

  // scanningStatus enum check (only when field is present)
  if (payload.scanningStatus && payload.scanningStatus.toString().trim() !== "") {
    if (!SCANNING_STATUS_LIST.includes(payload.scanningStatus)) {
      errors.push(
        `scanningStatus must be one of: ${SCANNING_STATUS_LIST.join(", ")}`,
      );
    }
  }

  // scanningDateTime format check (only when field is present)
  if (payload.scanningDateTime && payload.scanningDateTime.toString().trim() !== "") {
    if (!RAPISCAN_DATETIME_REGEX.test(payload.scanningDateTime.toString().trim())) {
      errors.push("scanningDateTime must be in YYYY-MM-DDTHH:MM:SS format");
    } else {
      const parsed = new Date(payload.scanningDateTime);
      if (isNaN(parsed.getTime())) {
        errors.push("scanningDateTime is not a valid date");
      }
    }
  }

  return errors;
}

exports.pushRapiscan = async (req, res) => {
  try {
    const validationErrors = validateRapiscanPayload(req.body);

    if (validationErrors.length) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join("; "),
      });
    }

    const { containerNumber, containerSize, scanningStatus, scanningDateTime } =
      req.body;

    await CustomsRapiscan.create({
      containerNumber: containerNumber.trim(),
      containerSize: containerSize.trim(),
      scanningStatus: scanningStatus.trim(),
      scanningDateTime: new Date(scanningDateTime),
      createdBy: req.operator.id,
    });

    return res.status(201).json({
      success: true,
      message: "Rapiscan details received successfully.",
      data: {
        containerNumber: containerNumber.trim(),
        containerSize: containerSize.trim(),
        scanningStatus: scanningStatus.trim(),
        scanningDateTime,
      },
    });
  } catch (error) {
    console.error("Error saving Rapiscan record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ---------------------------------------------------------------------------
// Customs Physical Examination
// ---------------------------------------------------------------------------

const EXAMINATION_REQUIRED_FIELDS = [
  "containerNumber",
  "igmNumber",
  "dateOfExamination",
  "examinationFindings",
  "discrepancyFound",
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function validateExaminationPayload(payload) {
  const errors = [];

  // Required-field presence check
  for (const field of EXAMINATION_REQUIRED_FIELDS) {
    if (!payload[field] || payload[field].toString().trim() === "") {
      errors.push(`${field} is required`);
    }
  }

  // dateOfExamination format check (only when field is present)
  if (payload.dateOfExamination && payload.dateOfExamination.toString().trim() !== "") {
    if (!DATE_REGEX.test(payload.dateOfExamination.toString().trim())) {
      errors.push("dateOfExamination must be in YYYY-MM-DD format");
    }
  }

  // discrepancyFound enum check (only when field is present)
  if (payload.discrepancyFound && payload.discrepancyFound.toString().trim() !== "") {
    if (!DISCREPANCY_FOUND_LIST.includes(payload.discrepancyFound)) {
      errors.push(
        `discrepancyFound must be one of: ${DISCREPANCY_FOUND_LIST.join(", ")}`,
      );
    }
  }

  return errors;
}

exports.submitExamination = async (req, res) => {
  try {
    const validationErrors = validateExaminationPayload(req.body);

    if (validationErrors.length) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join("; "),
      });
    }

    const {
      containerNumber,
      igmNumber,
      dateOfExamination,
      examinationFindings,
      discrepancyFound,
    } = req.body;

    // Duplicate check — same container + IGM combination
    const existing = await CustomsExamination.findOne({
      where: {
        containerNumber: containerNumber.trim(),
        igmNumber: igmNumber.trim(),
      },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Examination record already exists for container ${containerNumber}, IGM ${igmNumber}`,
      });
    }

    const examination = await CustomsExamination.create({
      containerNumber: containerNumber.trim(),
      igmNumber: igmNumber.trim(),
      dateOfExamination,
      examinationFindings: examinationFindings.trim(),
      discrepancyFound,
      createdBy: req.operator.id,
    });

    return res.status(201).json({
      success: true,
      message: "Customs examination details saved successfully.",
      data: {
        containerNumber: examination.containerNumber,
        igmNumber: examination.igmNumber,
        dateOfExamination: examination.dateOfExamination,
        examinationFindings: examination.examinationFindings,
        discrepancyFound: examination.discrepancyFound,
        createdAt: examination.createdAt,
      },
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Examination record with these details already exists",
      });
    }

    console.error("Error saving examination record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// ---------------------------------------------------------------------------
// OOC Push (unchanged — not part of new spec update)
// ---------------------------------------------------------------------------

// ISO 8601 datetime: YYYY-MM-DDTHH:MM:SS  (with or without timezone offset)
const OOC_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;

const OOC_REQUIRED_FIELDS = [
  "containerNumber",
  "containerSize",
  "oocStatus",
  "oocNumber",
  "dateTime",
];

function validateOocPayload(payload) {
  const errors = [];

  // Required-field presence check
  for (const field of OOC_REQUIRED_FIELDS) {
    if (!payload[field] || payload[field].toString().trim() === "") {
      errors.push(`${field} is required`);
    }
  }

  // dateTime format / validity check (only when the field is present)
  if (payload.dateTime && payload.dateTime.toString().trim() !== "") {
    if (!OOC_DATETIME_REGEX.test(payload.dateTime.toString().trim())) {
      errors.push("dateTime must be a valid datetime in YYYY-MM-DDTHH:MM:SS format");
    } else {
      const parsed = new Date(payload.dateTime);
      if (isNaN(parsed.getTime())) {
        errors.push("dateTime is not a valid date");
      }
    }
  }

  return errors;
}

exports.pushOoc = async (req, res) => {
  try {
    const validationErrors = validateOocPayload(req.body);

    if (validationErrors.length) {
      return res.status(400).json({
        success: false,
        message: validationErrors.join("; "),
      });
    }

    const { containerNumber, containerSize, oocStatus, oocNumber, dateTime } =
      req.body;

    // Duplicate check — oocNumber uniquely identifies an OOC transaction
    const existing = await CustomsOoc.findOne({
      where: { oocNumber: oocNumber.trim() },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Duplicate OOC transaction",
      });
    }

    const oocRecord = await CustomsOoc.create({
      containerNumber: containerNumber.trim(),
      containerSize: containerSize.trim(),
      oocStatus: oocStatus.trim(),
      oocNumber: oocNumber.trim(),
      dateTime: new Date(dateTime),
      receivedBy: req.operator.id,
    });

    return res.status(201).json({
      success: true,
      message: "OOC details received successfully.",
      data: {
        id: oocRecord.id,
        containerNumber: oocRecord.containerNumber,
        containerSize: oocRecord.containerSize,
        oocStatus: oocRecord.oocStatus,
        oocNumber: oocRecord.oocNumber,
        dateTime: oocRecord.dateTime,
        receivedAt: oocRecord.createdAt,
      },
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        success: false,
        message: "Duplicate OOC transaction",
      });
    }

    console.error("Error saving OOC record:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
