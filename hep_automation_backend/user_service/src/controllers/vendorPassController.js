const crypto = require("crypto");
const axios = require("axios");
const VendorPassRequest = require("../models/vendorPassRequestSchema");

const MONTH_CODES = [
  "JAN","FEB","MAR","APR","MAY","JUN",
  "JUL","AUG","SEP","OCT","NOV","DEC",
];

const VISITOR_TYPES = [
  { id: 1, name: "Govt Officials" },
  { id: 2, name: "Consultants" },
  { id: 3, name: "Students" },
  { id: 4, name: "Vendors" },
  { id: 5, name: "VIPs" },
  { id: 6, name: "Others" },
];

const { pool } = require("../dbconfig/db");
const ReferenceNumber = require("../models/referenceNumberSchema");

const buildReferenceNo = async (client) => {
  return await ReferenceNumber.generateVendorPassReference(client);
};

const buildToken = () =>
  crypto
    .randomBytes(48)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const FRONTEND_BASE =
  process.env.FRONTEND_BASE_URL || "http://localhost:3000";

const buildVendorLink = (token) =>
  `${FRONTEND_BASE}/vendor_pass/${token}`;

const sendVendorLinkEmail = async (intake) => {
  const url = process.env.EMAIL_SERVICE_URL;
  if (!url) {
    console.warn("[vendorPass] EMAIL_SERVICE_URL not set; skipping email send");
    return false;
  }

  const payload = {
    email: intake.vendorEmail,
    companyName: intake.companyName,
    referenceNo: intake.referenceNo,
    link: buildVendorLink(intake.token),
    validUpto: intake.validUpto,
    departmentName: intake.departmentName,
  };

  try {
    await axios.post(`${url}/api/email/sendVendorPassLink`, payload, {
      headers: { "x-service-name": "USER-SERVICE" },
      timeout: 8000,
    });
    return true;
  } catch (err) {
    console.error(
      "[vendorPass] Email send failed:",
      err.response?.data || err.message
    );
    return false;
  }
};

exports.getVisitorTypes = async (req, res) => {
  return res.status(200).json({ success: true, data: VISITOR_TYPES });
};

exports.createIntake = async (req, res) => {
  try {
    const {
      visitorTypeId,
      visitorTypeOther,
      purposeOfVisitId,
      purposeOther,
      passApplyMode,
      companyName,
      vendorEmail,
      vendorMobile,
      hasWorkOrder,
      refDocNo,
      equipmentMaterialDetails,
      remarks,
      noOfPersonsAllowed,
      noOfVehiclesAllowed,
      paymentMode,
      allowAuctionPassOnly,
      validUpto,
    } = req.body;

    if (!companyName || !vendorEmail || !vendorMobile || !validUpto) {
      return res.status(400).json({
        success: false,
        message:
          "companyName, vendorEmail, vendorMobile and validUpto are required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(vendorEmail)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid vendor email" });
    }
    if (!/^\d{10}$/.test(String(vendorMobile))) {
      return res
        .status(400)
        .json({ success: false, message: "Vendor mobile must be 10 digits" });
    }

    const persons = Number(noOfPersonsAllowed) || 0;
    const vehicles = Number(noOfVehiclesAllowed) || 0;
    if (persons + vehicles <= 0) {
      return res.status(400).json({
        success: false,
        message: "At least one person or vehicle quota must be set",
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    if (validUpto < today) {
      return res
        .status(400)
        .json({ success: false, message: "validUpto cannot be in the past" });
    }

    const hasWorkOrderBool =
      hasWorkOrder === true ||
      hasWorkOrder === "true" ||
      hasWorkOrder === "1";
    if (hasWorkOrderBool && !refDocNo) {
      return res.status(400).json({
        success: false,
        message:
          "refDocNo is required when work order is selected",
      });
    }

    const fileEntry =
      Array.isArray(req.files?.vendorWorkOrder) && req.files.vendorWorkOrder[0];
    const workOrderFilePath = fileEntry ? fileEntry.path : null;
    const workOrderFileName = fileEntry ? fileEntry.filename : null;

    const client = await pool.connect();
    try {
      const referenceNo = await buildReferenceNo(client);
      const token = buildToken();

      const intake = await VendorPassRequest.createIntake({
        referenceNo,
        token,
        createdByUserId: req.user.userId,
        departmentId: req.user.departmentId,
        departmentName: req.user.departmentName,
        visitorTypeId: visitorTypeId ? Number(visitorTypeId) : null,
        visitorTypeOther: visitorTypeOther || null,
        purposeOfVisitId: purposeOfVisitId ? Number(purposeOfVisitId) : null,
        purposeOther: purposeOther || null,
        passApplyMode: passApplyMode || "MULTIPLE",
        companyName,
        vendorEmail,
        vendorMobile: String(vendorMobile),
        hasWorkOrder: hasWorkOrderBool,
        refDocNo: refDocNo || null,
        workOrderFilePath,
        workOrderFileName,
        equipmentMaterialDetails: equipmentMaterialDetails || null,
        remarks: remarks || null,
        noOfPersonsAllowed: noOfPersonsAllowed ? Number(noOfPersonsAllowed) : 0,
        noOfVehiclesAllowed: noOfVehiclesAllowed ? Number(noOfVehiclesAllowed) : 0,
        paymentMode: paymentMode || "CASH",
        allowAuctionPassOnly: allowAuctionPassOnly === "true" || allowAuctionPassOnly === true,
        validUpto,
        status: "LINK_SENT",
      });

      const emailed = await sendVendorLinkEmail(intake);
      if (emailed) {
        await VendorPassRequest.markEmailSent(intake.id);
      }

      client.release();

      return res.status(201).json({
        success: true,
        message: emailed
          ? "Vendor pass link generated and emailed"
          : "Vendor pass link generated (email pending — please re-send)",
        data: {
          id: intake.id,
          referenceNo: intake.referenceNo,
          vendorLink: buildVendorLink(intake.token),
          validUpto: intake.validUpto,
          emailed,
        },
      });
    } catch (error) {
      client.release();
      console.error("createIntake error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal server error" });
    }
  } catch (error) {
    console.error("createIntake error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/* ──────────────────────────────────────────────────────────────────────
   GET /api/vendor-pass/list
   ────────────────────────────────────────────────────────────────────── */

exports.listIntakes = async (req, res) => {
  try {
    const { fromDate, toDate, companyName, scope } = req.query;

    const filters = {
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      companyName: companyName || undefined,
      departmentId: req.user.departmentId,
    };

    // scope=mine restricts to records created by this user
    if (scope === "mine") {
      filters.createdByUserId = req.user.userId;
    }

    const rows = await VendorPassRequest.list(filters);

    const data = rows.map((r) => {
      const submittedPersons = Array.isArray(r.submittedPersons)
        ? r.submittedPersons
        : [];
      const submittedVehicles = Array.isArray(r.submittedVehicles)
        ? r.submittedVehicles
        : [];
      return {
        id: r.id,
        referenceNo: r.referenceNo,
        token: r.token,
        createdByUserName: r.createdByUserName,
        createdAt: r.createdAt,
        departmentName: r.departmentName,
        companyName: r.companyName,
        vendorEmail: r.vendorEmail,
        vendorMobile: r.vendorMobile,
        hasWorkOrder: r.hasWorkOrder,
        refDocNo: r.refDocNo,
        workOrderFileName: r.workOrderFileName,
        noOfPersonsAllowed: r.noOfPersonsAllowed,
        noOfVehiclesAllowed: r.noOfVehiclesAllowed,
        paymentMode: r.paymentMode,
        allowAuctionPassOnly: r.allowAuctionPassOnly,
        validUpto: r.validUpto,
        status: r.status,
        stats: {
          personApplied: submittedPersons.length,
          personApproved: 0,
          personRejected: 0,
          vehicleApplied: submittedVehicles.length,
          vehicleApproved: 0,
          vehicleRejected: 0,
        },
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("listIntakes error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/* ──────────────────────────────────────────────────────────────────────
   POST /api/vendor-pass/:id/resend-link
   ────────────────────────────────────────────────────────────────────── */

exports.resendLink = async (req, res) => {
  try {
    const intake = await VendorPassRequest.getById(Number(req.params.id));
    if (!intake) {
      return res
        .status(404)
        .json({ success: false, message: "Intake not found" });
    }
    if (intake.status !== "LINK_SENT") {
      return res.status(409).json({
        success: false,
        message: `Cannot resend — current status is ${intake.status}`,
      });
    }
    if (String(intake.departmentId) !== String(req.user.departmentId)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden" });
    }

    const ok = await sendVendorLinkEmail(intake);
    if (ok) await VendorPassRequest.markEmailSent(intake.id);

    return res.status(200).json({
      success: ok,
      message: ok ? "Link re-sent" : "Email send failed",
    });
  } catch (error) {
    console.error("resendLink error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/* ──────────────────────────────────────────────────────────────────────
   DELETE /api/vendor-pass/:id/revoke
   ────────────────────────────────────────────────────────────────────── */

exports.revokeIntake = async (req, res) => {
  try {
    const intake = await VendorPassRequest.getById(Number(req.params.id));
    if (!intake) {
      return res
        .status(404)
        .json({ success: false, message: "Intake not found" });
    }
    if (intake.status !== "LINK_SENT") {
      return res.status(409).json({
        success: false,
        message: `Cannot revoke — current status is ${intake.status}`,
      });
    }
    if (String(intake.departmentId) !== String(req.user.departmentId)) {
      return res
        .status(403)
        .json({ success: false, message: "Forbidden" });
    }

    const updated = await VendorPassRequest.updateStatus(intake.id, "REVOKED");
    return res
      .status(200)
      .json({ success: true, message: "Intake revoked", data: updated });
  } catch (error) {
    console.error("revokeIntake error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/* ──────────────────────────────────────────────────────────────────────
   GET /api/vendor-pass/public/:token  (no auth)
   ────────────────────────────────────────────────────────────────────── */

exports.getPublicByToken = async (req, res) => {
  try {
    const intake = await VendorPassRequest.getByToken(req.params.token);
    if (!intake) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired link" });
    }

    if (intake.status !== "LINK_SENT") {
      return res.status(410).json({
        success: false,
        message: "This link is no longer active",
      });
    }

    // Expiry check based on validUpto
    const today = new Date().toISOString().slice(0, 10);
    const validUptoStr =
      typeof intake.validUpto === "string"
        ? intake.validUpto.slice(0, 10)
        : new Date(intake.validUpto).toISOString().slice(0, 10);

    if (validUptoStr < today) {
      await VendorPassRequest.updateStatus(intake.id, "EXPIRED");
      return res
        .status(410)
        .json({ success: false, message: "This link has expired" });
    }

    return res.status(200).json({
      success: true,
      data: {
        referenceNo: intake.referenceNo,
        departmentName: intake.departmentName,
        companyName: intake.companyName,
        vendorEmail: intake.vendorEmail,
        vendorMobile: intake.vendorMobile,
        passApplyMode: intake.passApplyMode,
        visitorTypeId: intake.visitorTypeId,
        visitorTypeOther: intake.visitorTypeOther,
        purposeOfVisitId: intake.purposeOfVisitId,
        purposeOther: intake.purposeOther,
        hasWorkOrder: intake.hasWorkOrder,
        refDocNo: intake.refDocNo,
        workOrderFilePath: intake.workOrderFilePath,
        workOrderFileName: intake.workOrderFileName,
        equipmentMaterialDetails: intake.equipmentMaterialDetails,
        remarks: intake.remarks,
        noOfPersonsAllowed: intake.noOfPersonsAllowed,
        noOfVehiclesAllowed: intake.noOfVehiclesAllowed,
        validUpto: validUptoStr,
        paymentMode: intake.paymentMode,
        allowAuctionPassOnly: intake.allowAuctionPassOnly,
        chargeMode: intake.allowAuctionPassOnly
          ? "AUCTION"
          : intake.paymentMode === "FREE"
            ? "FREE"
            : "CASH",
        status: intake.status,
      },
    });
  } catch (error) {
    console.error("getPublicByToken error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

/* ──────────────────────────────────────────────────────────────────────
   POST /api/vendor-pass/public/:token/submit  (no auth)
   ────────────────────────────────────────────────────────────────────── */

exports.submitPublicVendorForm = async (req, res) => {
  try {
    const token = req.params.token;
    const intake = await VendorPassRequest.getByToken(token);

    if (!intake) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid or expired link" });
    }

    if (intake.status !== "LINK_SENT") {
      return res.status(410).json({
        success: false,
        message: "This link is no longer active",
      });
    }

    // Expiry check
    const today = new Date().toISOString().slice(0, 10);
    const validUptoStr =
      typeof intake.validUpto === "string"
        ? intake.validUpto.slice(0, 10)
        : new Date(intake.validUpto).toISOString().slice(0, 10);
    if (validUptoStr < today) {
      await VendorPassRequest.updateStatus(intake.id, "EXPIRED");
      return res
        .status(410)
        .json({ success: false, message: "This link has expired" });
    }

    // Parse persons & vehicles arrays from body
    let persons = [];
    let vehicles = [];
    try {
      persons = JSON.parse(req.body.persons || "[]");
      vehicles = JSON.parse(req.body.vehicles || "[]");
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid persons or vehicles JSON",
      });
    }

    /* ===== CHANGE START =====
       Normalize passType values (YEARLY -> ANNUAL)
    ===== */
    const normalizePassType = (type) => {
      if (type === "YEARLY") return "ANNUAL";
      return type;
    };

    if (persons && Array.isArray(persons)) {
      persons = persons.map((p) => ({
        ...p,
        passType: normalizePassType(p.passType)
      }));
    }

    if (vehicles && Array.isArray(vehicles)) {
      vehicles = vehicles.map((v) => ({
        ...v,
        passType: normalizePassType(v.passType)
      }));
    }
    /* ===== CHANGE END ===== */

    // Validate against intake quotas
    if (!Array.isArray(persons) || !Array.isArray(vehicles)) {
      return res.status(400).json({
        success: false,
        message: "persons and vehicles must be arrays",
      });
    }
    if (persons.length > Number(intake.noOfPersonsAllowed || 0)) {
      return res.status(400).json({
        success: false,
        message: `Persons exceed allowed quota (${intake.noOfPersonsAllowed})`,
      });
    }
    if (vehicles.length > Number(intake.noOfVehiclesAllowed || 0)) {
      return res.status(400).json({
        success: false,
        message: `Vehicles exceed allowed quota (${intake.noOfVehiclesAllowed})`,
      });
    }

    /* ── Merge uploaded files into JSONB entries (positional, like agent flow) ──
       Frontend appends person/vehicle files in the SAME ORDER as persons/vehicles
       arrays. Multer preserves arrival order per field-name, so files[fieldName][i]
       corresponds to entry i in the matching array.
    */
    const files = req.files || {};
    const attachFile = (entry, fieldName, idx, pathKey, nameKey) => {
      const f = files[fieldName]?.[idx];
      if (f) {
        entry[pathKey] = f.path;
        entry[nameKey] = f.originalname;
      }
    };

    persons = persons.map((p, i) => {
      const out = { ...p };
      attachFile(out, "personPhoto", i, "photoFilePath", "photoFileName");
      attachFile(out, "personAadhar", i, "aadharPDFFilePATH", "aadharPDFFileName");
      attachFile(out, "personIdProof", i, "idProofFilePath", "idProofFileName");
      attachFile(out, "requisitionLetter", i, "requisitionLetterPath", "requisitionLetterName");
      attachFile(out, "driverLicense", i, "driverLicensePath", "driverLicenseName");
      attachFile(out, "policeVerification", i, "policeVerificationPath", "policeVerificationName");
      attachFile(out, "employmentProof", i, "employmentProofPath", "employmentProofName");
      attachFile(out, "chaLicenseCopy", i, "chaLicensePath", "chaLicenseName");
      attachFile(out, "passportDoc", i, "passportPath", "passportName");
      return out;
    });

    vehicles = vehicles.map((v, i) => {
      const out = { ...v };
      attachFile(out, "vehicleRC", i, "scannedCopyFilePath", "scannedCopyFileName");
      attachFile(out, "vehicleInsurance", i, "insuranceFilePath", "insuranceFileName");
      attachFile(out, "vehiclePermit", i, "permitFilePath", "permitFileName");
      attachFile(out, "vehicleFitness", i, "fitnessFilePath", "fitnessFileName");
      attachFile(out, "vehicleRequestLetter", i, "requestLetterPath", "requestLetterName");
      attachFile(out, "vehicleTax", i, "taxFilePath", "taxFileName");
      attachFile(out, "vehicleEmission", i, "emissionFilePath", "emissionFileName");
      return out;
    });

    // Persist
    const updated = await VendorPassRequest.submitVendorForm(
      token,
      persons,
      vehicles
    );

    return res.status(200).json({
      success: true,
      message: "Application submitted successfully",
      data: {
        referenceNo: updated.referenceNo,
        status: updated.status,
        personsSubmitted: persons.length,
        vehiclesSubmitted: vehicles.length,
      },
    });
  } catch (error) {
    console.error("submitPublicVendorForm error:", error);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    });
    return res
      .status(500)
      .json({ success: false, message: error.message || "Internal server error" });
  }
};

/* ──────────────────────────────────────────────────────────────────────
   Vendor Pass Approval Controller Functions
   ────────────────────────────────────────────────────────────────────── */

exports.approveVendorPerson = async (req, res) => {
  try {
    const { id, personIndex } = req.params;
    const result = await VendorPassRequest.approveVendorPerson(
      Number(id),
      Number(personIndex)
    );
    if (!result) {
      return res.status(404).json({ success: false, message: "Vendor pass not found" });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("approveVendorPerson error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

exports.rejectVendorPerson = async (req, res) => {
  try {
    const { id, personIndex } = req.params;
    const { rejectedReason } = req.body;
    const result = await VendorPassRequest.rejectVendorPerson(
      Number(id),
      Number(personIndex),
      rejectedReason
    );
    if (!result) {
      return res.status(404).json({ success: false, message: "Vendor pass not found" });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("rejectVendorPerson error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

exports.approveVendorVehicle = async (req, res) => {
  try {
    const { id, vehicleIndex } = req.params;
    const result = await VendorPassRequest.approveVendorVehicle(
      Number(id),
      Number(vehicleIndex)
    );
    if (!result) {
      return res.status(404).json({ success: false, message: "Vendor pass not found" });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("approveVendorVehicle error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

exports.rejectVendorVehicle = async (req, res) => {
  try {
    const { id, vehicleIndex } = req.params;
    const { rejectedReason } = req.body;
    const result = await VendorPassRequest.rejectVendorVehicle(
      Number(id),
      Number(vehicleIndex),
      rejectedReason
    );
    if (!result) {
      return res.status(404).json({ success: false, message: "Vendor pass not found" });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("rejectVendorVehicle error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};

exports.completeVendorReview = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await VendorPassRequest.completeVendorPassReview(Number(id));
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error("completeVendorReview error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
};
