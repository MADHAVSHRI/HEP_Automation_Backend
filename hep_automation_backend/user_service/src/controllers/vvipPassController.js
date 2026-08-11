const fs = require("fs");
const path = require("path");
const axios = require("axios");
const VvipPassSchema = require("../models/vvipPassSchema");

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const filePath = (file) => {
  if (!file) return null;
  return file.path || null;
};

const findFile = (files, fieldName) => {
  if (!files) return null;
  if (Array.isArray(files)) {
    return files.find((file) => file.fieldname === fieldName) || null;
  }
  return files[fieldName]?.[0] || null;
};

const generateReferenceNo = () => {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
  return `VVIP${stamp}`;
};

const QR_SERVICE_URL = process.env.QR_SERVICE_URL || "http://localhost:5007";
const SERVICE_AUTH_KEY = process.env.SERVICE_AUTH_KEY || "";

const requestVvipQrPdf = async (requestId) => {
  if (!SERVICE_AUTH_KEY) {
    const error = new Error("QR service key is not configured.");
    error.statusCode = 500;
    throw error;
  }

  return axios.post(
    `${QR_SERVICE_URL}/api/qr/vvip-pass/${requestId}`,
    {},
    {
      headers: {
        "x-service-key": SERVICE_AUTH_KEY,
        "x-service-name": "USER-SERVICE",
      },
      responseType: "arraybuffer",
    },
  );
};

const getUserId = (user = {}) =>
  user.userId || user.id || user.user_id || user.employeeId || null;

const getDepartmentId = (user = {}) =>
  user.departmentId || user.department_id || null;

const getDepartmentName = (user = {}, fallback) =>
  user.departmentName || user.department || user.department_name || fallback || null;

const validateRequest = ({ noOfPasses, persons, vehicles, visitDate, validityFrom, validityTo }) => {
  const requestedPasses = Number(noOfPasses) || 0;

  if (!visitDate) {
    return "Visit Date is required.";
  }

  if (!validityFrom || !validityTo) {
    return "Validity From and Validity To are required.";
  }

  if (!requestedPasses) {
    return "No. of Passes is required.";
  }

  if (!persons.length) {
    return "At least one VVIP person must be added.";
  }

  if (persons.some((person) => !String(person.name || "").trim())) {
    return "VVIP person name is required.";
  }

  if (requestedPasses > 10) {
    return "Maximum 10 VVIP persons are allowed per request.";
  }

  if (requestedPasses > 0 && persons.length > requestedPasses) {
    return `Only ${requestedPasses} VVIP person(s) can be added for this request.`;
  }

  if (vehicles.length > 10) {
    return "Maximum 10 vehicles are allowed per VVIP request.";
  }

  const vehicleMissingDocs = vehicles.find(
    (vehicle) => !vehicle.rcBookPath || !vehicle.insuranceDocumentPath,
  );
  if (vehicleMissingDocs) {
    return "RC Book and Insurance Document are mandatory for every VVIP vehicle pass.";
  }

  if (validityFrom && validityTo) {
    const from = new Date(validityFrom);
    const to = new Date(validityTo);
    const max = new Date(from);
    max.setDate(max.getDate() + 2);

    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && to > max) {
      return "Maximum validity allowed is 2 days.";
    }
  }

  return null;
};

exports.createVvipPass = async (req, res) => {
  try {
    const persons = parseJsonArray(req.body.persons).slice(0, 10);
    const vehicles = parseJsonArray(req.body.vehicles);

    const personsWithFiles = persons.map((person, index) => ({
      ...person,
      idProofFilePath: filePath(findFile(req.files, `person_${index}_idProofFile`)),
      documentPath: filePath(findFile(req.files, `person_${index}_document`)),
    }));

    const vehiclesWithFiles = vehicles.map((vehicle, index) => ({
      ...vehicle,
      rcBookPath: filePath(findFile(req.files, `vehicle_${index}_rcBook`)),
      insuranceDocumentPath: filePath(findFile(req.files, `vehicle_${index}_insuranceDocument`)),
    }));

    const validationError = validateRequest({
      noOfPasses: req.body.noOfPasses,
      persons,
      vehicles: vehiclesWithFiles,
      visitDate: req.body.visitDate,
      validityFrom: req.body.validityFrom,
      validityTo: req.body.validityTo,
    });

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const created = await VvipPassSchema.createRequest({
      referenceNo: generateReferenceNo(),
      createdByUserId: getUserId(req.user),
      departmentId: getDepartmentId(req.user),
      departmentName: getDepartmentName(req.user, req.body.department),
      visitPurpose: req.body.visitPurpose,
      visitDate: req.body.visitDate || null,
      validityFrom: req.body.validityFrom || null,
      validityTo: req.body.validityTo || null,
      noOfPasses: req.body.noOfPasses || persons.length,
      remarks: req.body.remarks,
      persons: personsWithFiles,
      vehicles: vehiclesWithFiles,
    });

    return res.status(201).json({
      success: true,
      message: "VVIP pass request submitted successfully.",
      data: created,
    });
  } catch (error) {
    console.error("Create VVIP pass error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to submit VVIP pass request.",
    });
  }
};

exports.resubmitVvipPass = async (req, res) => {
  try {
    const persons = parseJsonArray(req.body.persons).slice(0, 10);
    const vehicles = parseJsonArray(req.body.vehicles);

    const personsWithFiles = persons.map((person, index) => ({
      ...person,
      idProofFilePath:
        filePath(findFile(req.files, `person_${index}_idProofFile`)) ||
        person.idProofFilePath ||
        null,
      documentPath:
        filePath(findFile(req.files, `person_${index}_document`)) ||
        person.documentPath ||
        null,
    }));

    const vehiclesWithFiles = vehicles.map((vehicle, index) => ({
      ...vehicle,
      rcBookPath:
        filePath(findFile(req.files, `vehicle_${index}_rcBook`)) ||
        vehicle.rcBookPath ||
        null,
      insuranceDocumentPath:
        filePath(findFile(req.files, `vehicle_${index}_insuranceDocument`)) ||
        vehicle.insuranceDocumentPath ||
        null,
    }));

    const existing = await VvipPassSchema.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "VVIP pass not found." });
    }

    if (existing.status !== "RETURNED") {
      return res.status(400).json({
        success: false,
        message: "Only returned VVIP pass requests can be resubmitted.",
      });
    }

    const validationError = validateRequest({
      noOfPasses: req.body.noOfPasses,
      persons,
      vehicles: vehiclesWithFiles,
      visitDate: req.body.visitDate,
      validityFrom: req.body.validityFrom,
      validityTo: req.body.validityTo,
    });

    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    const updated = await VvipPassSchema.replaceRequest(req.params.id, {
      departmentName: getDepartmentName(req.user, req.body.department),
      visitPurpose: req.body.visitPurpose,
      visitDate: req.body.visitDate || null,
      validityFrom: req.body.validityFrom || null,
      validityTo: req.body.validityTo || null,
      noOfPasses: req.body.noOfPasses || persons.length,
      remarks: req.body.remarks,
      persons: personsWithFiles,
      vehicles: vehiclesWithFiles,
    });

    return res.json({
      success: true,
      message: "VVIP pass request resubmitted successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("Resubmit VVIP pass error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to resubmit VVIP pass request.",
    });
  }
};

exports.listVvipPasses = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const filters = {};

    if (req.query.status) filters.status = req.query.status;
    if (role === "hod") filters.createdByUserId = getUserId(req.user);

    const rows = await VvipPassSchema.list(filters);
    return res.json({ success: true, data: rows });
  } catch (error) {
    console.error("List VVIP passes error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load VVIP pass requests.",
    });
  }
};

exports.getVvipPass = async (req, res) => {
  try {
    const row = await VvipPassSchema.getById(req.params.id);

    if (!row) {
      return res.status(404).json({ success: false, message: "VVIP pass not found." });
    }

    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("Get VVIP pass error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load VVIP pass request.",
    });
  }
};

exports.getVvipQrData = async (req, res) => {
  try {
    const row = await VvipPassSchema.getById(req.params.id);

    if (!row) {
      return res.status(404).json({ success: false, message: "VVIP pass not found." });
    }

    return res.json({ success: true, data: row });
  } catch (error) {
    console.error("Get VVIP QR data error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to load VVIP QR data.",
    });
  }
};

exports.downloadVvipPdf = async (req, res) => {
  try {
    let row = await VvipPassSchema.getById(req.params.id);

    if (!row) {
      return res.status(404).json({ success: false, message: "VVIP pass not found." });
    }

    if (row.status !== "APPROVED") {
      return res.status(400).json({
        success: false,
        message: "QR PDF is available only after Traffic approval.",
      });
    }

    if (row.qrPdfPath) {
      const absolutePath = path.resolve(row.qrPdfPath);
      if (fs.existsSync(absolutePath)) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${row.referenceNo}.pdf"`);
        return res.sendFile(absolutePath);
      }
    }

    const qrResponse = await requestVvipQrPdf(row.id);
    const generatedPath = qrResponse.headers["x-pdf-path"];

    if (generatedPath) {
      await VvipPassSchema.updateQrPdfPath(row.id, generatedPath);
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${row.referenceNo}.pdf"`);
    return res.send(Buffer.from(qrResponse.data));
  } catch (error) {
    console.error("Download VVIP PDF error:", error);
    return res.status(error.statusCode || error.response?.status || 500).json({
      success: false,
      message:
        error.response?.data?.message ||
        error.message ||
        "Failed to download VVIP QR PDF.",
    });
  }
};

exports.approveVvipPass = async (req, res) => {
  try {
    const updated = await VvipPassSchema.updateStatus(req.params.id, {
      status: "APPROVED",
      approvedBy: req.user?.username || req.user?.loginId || req.user?.role || "Traffic",
      qrPdfPath: req.body.qrPdfPath || null,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "VVIP pass not found." });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Approve VVIP pass error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to approve VVIP pass request.",
    });
  }
};

exports.rejectVvipPass = async (req, res) => {
  try {
    const reason = String(req.body.reason || req.body.rejectedReason || "").trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Please enter rejection reason.",
      });
    }

    const updated = await VvipPassSchema.updateStatus(req.params.id, {
      status: "REJECTED",
      rejectedReason: reason,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "VVIP pass not found." });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Reject VVIP pass error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to reject VVIP pass request.",
    });
  }
};

exports.returnVvipPass = async (req, res) => {
  try {
    const reason = String(req.body.reason || req.body.returnReason || "").trim();

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Revert reason is required.",
      });
    }

    const updated = await VvipPassSchema.updateStatus(req.params.id, {
      status: "RETURNED",
      rejectedReason: reason,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "VVIP pass not found." });
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Return VVIP pass error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to revert VVIP pass request.",
    });
  }
};
