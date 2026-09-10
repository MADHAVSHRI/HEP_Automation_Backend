const {
  loginOperator,
  pushRapiscanRecord,
  submitExaminationRecord,
  pushOocRecord,
} = require("../services/customsService");
const {
  DISCREPANCY_FOUND_LIST,
  SCANNING_STATUS_LIST,
} = require("../constants/constants");

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

exports.login = async (req, res) => {
  try {
    const result = await loginOperator(req.body);
    return res.status(200).json({
      success: true,
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    if (statusCode !== 500) {
      return res.status(statusCode).json({
        success: false,
        message: error.message,
      });
    }
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

const RAPISCAN_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const RAPISCAN_REQUIRED_FIELDS = [
  "containerNumber",
  "containerSize",
  "scanningStatus",
  "scanningDateTime",
];

function validateRapiscanPayload(payload) {
  const errors = [];

  if (!payload || typeof payload !== "object") {
    return ["Invalid payload format"];
  }

  for (const field of RAPISCAN_REQUIRED_FIELDS) {
    if (!payload[field] || payload[field].toString().trim() === "") {
      errors.push(`${field} is required`);
    }
  }

  if (payload.scanningStatus && payload.scanningStatus.toString().trim() !== "") {
    if (!SCANNING_STATUS_LIST.includes(payload.scanningStatus)) {
      errors.push(
        `scanningStatus must be one of: ${SCANNING_STATUS_LIST.join(", ")}`,
      );
    }
  }

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

    const result = await pushRapiscanRecord({
      payload: req.body,
      operatorId: req.operator.id,
    });

    if (result.status === "ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: result.message || "Duplicate Rapiscan transaction",
      });
    }

    return res.status(201).json({
      success: true,
      message: result.message || "Rapiscan details received successfully.",
      data: result.data,
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

  if (!payload || typeof payload !== "object") {
    return ["Invalid payload format"];
  }

  for (const field of EXAMINATION_REQUIRED_FIELDS) {
    if (!payload[field] || payload[field].toString().trim() === "") {
      errors.push(`${field} is required`);
    }
  }

  if (payload.dateOfExamination && payload.dateOfExamination.toString().trim() !== "") {
    if (!DATE_REGEX.test(payload.dateOfExamination.toString().trim())) {
      errors.push("dateOfExamination must be in YYYY-MM-DD format");
    }
  }

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

    const result = await submitExaminationRecord({
      payload: req.body,
      operatorId: req.operator.id,
    });

    if (result.status === "ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(201).json({
      success: true,
      message: result.message || "Customs examination details saved successfully.",
      data: result.data,
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
// OOC Push
// ---------------------------------------------------------------------------

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

  if (!payload || typeof payload !== "object") {
    return ["Invalid payload format"];
  }

  for (const field of OOC_REQUIRED_FIELDS) {
    if (!payload[field] || payload[field].toString().trim() === "") {
      errors.push(`${field} is required`);
    }
  }

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

    const result = await pushOocRecord({
      payload: req.body,
      operatorId: req.operator.id,
    });

    if (result.status === "ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: result.message || "Duplicate OOC transaction",
      });
    }

    return res.status(201).json({
      success: true,
      message: result.message || "OOC details received successfully.",
      data: result.data,
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
