/**
 * bulkPassController.js
 *
 * Controller for the Bulk Pass Module in user_service.
 * Mirrors vendorPassController.js architecture exactly.
 *
 * Requirements: 1.1–1.10, 2.1, 2.2, 3.1–3.4, 4.1–4.5, 7.1–7.4,
 *               9.1–9.3, 10.1–10.3, 11.1, 11.2, 11.5, 11.8
 */

const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const AdmZip = require("adm-zip");

const BulkPassSchema = require("../models/bulkPassSchema");
const ReferenceNumber = require("../models/referenceNumberSchema");
const { BULK_VISITOR_TYPES } = require("../constants/constants");
const { encryptToken, decryptToken } = require("../utils/cryptoUtils");
const { pool } = require("../dbconfig/db");
const { parseAndValidate, buildErrorReport } = require("../services/excelParserService");
const { compressPhotoBuffer, compressDocumentFile } = require("../services/photoCompressionService");

// ── Helpers ────────────────────────────────────────────────────────────────

const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || "";
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || "";

const buildToken = () =>
  crypto
    .randomBytes(9)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const buildUploadLink = (token) => `${FRONTEND_BASE}/bulk_pass/${encryptToken(token)}`;

// ── Encrypted-link resolution ───────────────────────────────────────────────
// All public bulk-pass links carry an AES-256-GCM encrypted token/id in the URL
// (mirrors the vendor-pass scheme). These helpers transparently decrypt the
// incoming value and fall back to treating it as raw (so older plain links and
// internal numeric ids keep working).

const getResolvedToken = (tokenOrHash) => {
  if (!tokenOrHash) return "";
  const decrypted = decryptToken(tokenOrHash);
  return decrypted || tokenOrHash;
};

// Resolve an encrypted-or-numeric id param to a Number (NaN if unresolvable).
const resolveId = (idOrHash) => {
  if (!idOrHash) return NaN;
  const decrypted = decryptToken(idOrHash);
  const resolved = decrypted || idOrHash;
  return Number(resolved);
};

// Allowed upload-link validity windows (hours). Default is 48h.
const ALLOWED_LINK_VALIDITY_HOURS = [24, 48];
const DEFAULT_LINK_VALIDITY_HOURS = 48;

const normalizeLinkValidityHours = (value) => {
  const n = Number(value);
  return ALLOWED_LINK_VALIDITY_HOURS.includes(n) ? n : DEFAULT_LINK_VALIDITY_HOURS;
};

// Compute the absolute expiry timestamp for an upload link.
const computeTokenExpiry = (hours) =>
  new Date(Date.now() + normalizeLinkValidityHours(hours) * 60 * 60 * 1000).toISOString();

/**
 * Convert a DD/MM/YYYY date string into ISO YYYY-MM-DD for safe insertion into
 * a Postgres DATE (DATEONLY) column. Returns null for empty/invalid input so
 * the column simply stores NULL instead of throwing a date-parse error.
 */
function dobToISO(value) {
  if (!value || typeof value !== "string") return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const year = parseInt(yyyy, 10);
  // Basic range guard so an impossible date never reaches the DB
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${yyyy}-${mm}-${dd}`;
}

// ── Email helpers ──────────────────────────────────────────────────────────

async function sendEmail(endpoint, payload) {
  if (!EMAIL_SERVICE_URL) {
    console.warn("[bulkPass] EMAIL_SERVICE_URL not set; skipping email");
    return false;
  }
  try {
    await axios.post(`${EMAIL_SERVICE_URL}/api/email/${endpoint}`, payload, {
      headers: { "x-service-name": "USER-SERVICE" },
      timeout: 8000,
    });
    return true;
  } catch (err) {
    console.error(`[bulkPass] Email send failed (${endpoint}):`, err.response?.data || err.message);
    return false;
  }
}

// ── Validators ─────────────────────────────────────────────────────────────

function validateIntakeBody(body) {
  const {
    visitorType,
    companyName,
    applicantEmail,
    applicantMobile,
    noOfPersons,
    noOfVehicles,
    validityFrom,
    validityUpto,
  } = body;

  if (!visitorType || !companyName || !applicantEmail || !applicantMobile || !validityUpto) {
    return { ok: false, status: 400, message: "visitorType, companyName, applicantEmail, applicantMobile and validityUpto are required" };
  }

  if (!BULK_VISITOR_TYPES.includes(visitorType)) {
    return { ok: false, status: 400, message: "Invalid visitor type" };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicantEmail)) {
    return { ok: false, status: 400, message: "Invalid applicant email" };
  }

  if (!/^\d{10}$/.test(String(applicantMobile))) {
    return { ok: false, status: 400, message: "Applicant mobile must be 10 digits" };
  }

  const persons = Number(noOfPersons) || 0;
  if (persons < 0 || persons > 30) {
    return { ok: false, status: 400, message: "Number of persons must be between 0 and 30" };
  }

  const vehicles = Number(noOfVehicles) || 0;
  if (vehicles < 0 || vehicles > 20) {
    return { ok: false, status: 400, message: "Number of vehicles must be between 0 and 20" };
  }

  if (!validityUpto || new Date(validityUpto) <= new Date()) {
    return { ok: false, status: 400, message: "Validity upto must be a future date" };
  }

  if (validityFrom) {
    if (isNaN(new Date(validityFrom).getTime())) {
      return { ok: false, status: 400, message: "Invalid validity from date" };
    }
    if (new Date(validityFrom) >= new Date(validityUpto)) {
      return { ok: false, status: 400, message: "Validity from must be before validity upto" };
    }
  }

  return { ok: true };
}

// ── Controller exports ─────────────────────────────────────────────────────

/**
 * GET /api/bulk-pass/visitor-types  (protected)
 */
/**
 * GET /api/bulk-pass/public/blacklist-check?entity_type=PERSON&identifier=123456789012
 * Public endpoint — no auth required. Used by the applicant upload form for real-time checks.
 * Checks PERSON/DRIVER (Aadhaar) and VEHICLE (reg number).
 */
exports.publicBlacklistCheck = async (req, res) => {
  try {
    const { entity_type, identifier } = req.query;
    if (!entity_type || !identifier) {
      return res.status(400).json({ success: false, message: "entity_type and identifier are required" });
    }

    const entityTypes = ["PERSON", "VEHICLE", "DRIVER"];
    if (!entityTypes.includes(entity_type.toUpperCase())) {
      return res.status(400).json({ success: false, message: "entity_type must be PERSON, DRIVER, or VEHICLE" });
    }

    const normId = entity_type.toUpperCase() === "VEHICLE"
      ? identifier.replace(/[\s\-]/g, "").toUpperCase()
      : String(identifier).replace(/\s+/g, "").toUpperCase();

    let query, params;
    if (entity_type.toUpperCase() === "VEHICLE") {
      query = `SELECT id, entity_type, reason, reason_code, status FROM blacklist_entries
               WHERE entity_type = 'VEHICLE'
                 AND REPLACE(REPLACE(UPPER(identifier), ' ', ''), '-', '') = $1
                 AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')`;
      params = [normId];
    } else {
      query = `SELECT id, entity_type, reason, reason_code, status FROM blacklist_entries
               WHERE entity_type IN ('PERSON', 'DRIVER')
                 AND identifier = $1
                 AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')`;
      params = [normId];
    }

    const result = await pool.query(query, params);
    const isBlacklisted = result.rows.length > 0;

    return res.json({
      success: true,
      isBlacklisted,
      data: isBlacklisted ? {
        entity_type: result.rows[0].entity_type,
        status: result.rows[0].status,
        reason: result.rows[0].reason,
        reason_code: result.rows[0].reason_code,
      } : null,
    });
  } catch (err) {
    console.error("[bulkPass] publicBlacklistCheck error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getBulkVisitorTypes = async (req, res) => {  return res.status(200).json({ success: true, data: BULK_VISITOR_TYPES });
};

/**
 * POST /api/bulk-pass/intake  (protected — Dept User)
 * Requirements: 1.1–1.10
 */
exports.createIntake = async (req, res) => {
  try {
    const validation = validateIntakeBody(req.body);
    if (!validation.ok) {
      return res.status(validation.status).json({ success: false, message: validation.message });
    }

    const {
      visitorType,
      companyName,
      applicantEmail,
      applicantMobile,
      refDocNo,
      workOrderRequired,
      noOfPersons,
      noOfVehicles,
      paymentMode,
      purpose,
      purposeOfVisit,
      validityFrom,
      validityUpto,
      remarks,
      linkValidityHours,
    } = req.body;

    // The create forms submit "purposeOfVisit"; accept it as a fallback for "purpose".
    const resolvedPurpose = purpose || purposeOfVisit || "";

    const resolvedLinkValidityHours = normalizeLinkValidityHours(linkValidityHours);

    // Work order file (reuses uploadMiddleware.js for the single workOrder field)
    const fileEntry = Array.isArray(req.files?.workOrder) && req.files.workOrder[0];
    const workOrderFilePath = fileEntry ? fileEntry.path : null;

    const client = await pool.connect();
    let batch;
    try {
      const refNo = await ReferenceNumber.generateBulkPassReference(client);
      const token = buildToken();

      batch = await BulkPassSchema.createBatch({
        refNo,
        token,
        tokenActive: true,
        createdByUserId: req.user.userId,
        departmentId: req.user.departmentId,
        departmentName: req.user.departmentName,
        visitorType,
        companyName,
        applicantEmail,
        applicantMobile: String(applicantMobile),
        refDocNo: refDocNo || null,
        workOrderRequired: workOrderRequired === true || workOrderRequired === "true",
        noOfPersons: Number(noOfPersons) || 0,
        noOfVehicles: Number(noOfVehicles) || 0,
        paymentMode: paymentMode || "CASH",
        purpose: resolvedPurpose,
        validityFrom: validityFrom || null,
        validityUpto,
        remarks: remarks || null,
        status: "DRAFT",
        linkValidityHours: resolvedLinkValidityHours,
        tokenExpiresAt: computeTokenExpiry(resolvedLinkValidityHours),
      });
    } finally {
      client.release();
    }

    // Log DRAFT creation
    await BulkPassSchema.logTransition(batch.id, "DRAFT", req.user.userId, "Batch created");

    // Send invitation email (fire-and-forget; don't block response)
    sendEmail("sendBulkPassInvitation", {
      email: applicantEmail,
      refNo: batch.refNo,
      companyName,
      visitorType,
      noOfPersons: batch.noOfPersons,
      noOfVehicles: batch.noOfVehicles,
      validityFrom,
      validityUpto,
      uploadLink: buildUploadLink(batch.token),
      departmentName: batch.departmentName,
      linkValidityHours: resolvedLinkValidityHours,
    }).catch(() => {});

    return res.status(201).json({
      success: true,
      message: "Bulk pass batch created",
      data: {
        id: batch.id,
        refNo: batch.refNo,
        token: batch.token,
        uploadLink: buildUploadLink(batch.token),
        status: batch.status,
      },
    });
  } catch (err) {
    console.error("[bulkPass] createIntake error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/resend-invitation  (protected — Dept User)
 * Resends the invitation email to the applicant for DRAFT or RETURNED_TO_APPLICANT batches.
 */
exports.resendInvitation = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid batch ID" });
    }

    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    const role = (req.user?.role || "").toLowerCase();
    const deptName = (req.user?.departmentName || "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrator" || role === "super admin" || role === "superadmin";
    const isTrafficApprover = (role === "approval" && deptName.includes("traffic")) || role.includes("traffic");

    if (!isAdmin && !isTrafficApprover && batch.createdByUserId !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (!["DRAFT", "RETURNED_TO_APPLICANT"].includes(batch.status)) {
      return res.status(400).json({ success: false, message: "Invitation can only be resent for DRAFT or RETURNED batches" });
    }

    if (!batch.tokenActive) {
      return res.status(400).json({ success: false, message: "Upload link is no longer active" });
    }

    // Refresh the link's validity window so the applicant gets a fresh
    // 24h/48h period from this resend.
    const newExpiry = computeTokenExpiry(batch.linkValidityHours);

    const sent = await sendEmail("sendBulkPassInvitation", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      visitorType: batch.visitorType,
      noOfPersons: batch.noOfPersons,
      noOfVehicles: batch.noOfVehicles,
      validityFrom: batch.validityFrom,
      validityUpto: batch.validityUpto,
      uploadLink: buildUploadLink(batch.token),
      departmentName: batch.departmentName,
      linkValidityHours: batch.linkValidityHours,
    });

    if (!sent) {
      return res.status(500).json({ success: false, message: "Failed to send email. Please try again." });
    }

    // Update lastEmailSentAt and refresh the link expiry
    await BulkPassSchema.setStatus(batch.id, batch.status, {
      lastEmailSentAt: new Date().toISOString(),
      tokenExpiresAt: newExpiry,
    });

    return res.status(200).json({
      success: true,
      message: "Invitation email resent successfully",
      data: { email: batch.applicantEmail, sentAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[bulkPass] resendInvitation error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/list  (protected — Dept User)
 * Requirements: 2.1, 2.2
 */
exports.listBatches = async (req, res) => {
  try {
    const { refNo, companyName, status, fromDate, toDate, search } = req.query;

    const role = (req.user?.role || "").toLowerCase();
    const deptName = (req.user?.departmentName || "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrator" || role === "super admin" || role === "superadmin";
    const isTrafficApprover = (role === "approval" && deptName.includes("traffic")) || role.includes("traffic");

    const filters = {
      refNo: refNo || undefined,
      companyName: companyName || undefined,
      status: status || undefined,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      search: search || undefined,
    };

    if (!isAdmin && !isTrafficApprover) {
      filters.createdByUserId = req.user.userId;
    }

    const rows = await BulkPassSchema.list(filters);
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("[bulkPass] listBatches error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/:id  (protected — Dept User)
 * Requirements: 3.4
 */
exports.getBatchDetail = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) {
      return res.status(400).json({ success: false, message: "Invalid batch ID" });
    }
    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    const role = (req.user?.role || "").toLowerCase();
    const deptName = (req.user?.departmentName || "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrator" || role === "super admin" || role === "superadmin";
    const isTrafficApprover = (role === "approval" && deptName.includes("traffic")) || role.includes("traffic");

    if (!isAdmin && !isTrafficApprover && batch.createdByUserId !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const [persons, uploads, statusLog] = await Promise.all([
      BulkPassSchema.getPersonsByBatch(id),
      BulkPassSchema.getUploadsByBatch(id),
      BulkPassSchema.getStatusLog(id),
    ]);

    return res.status(200).json({
      success: true,
      data: { batch, persons, uploads, statusLog },
    });
  } catch (err) {
    console.error("[bulkPass] getBatchDetail error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * PUT /api/bulk-pass/:id  (protected — Dept User)
 * Requirements: 9.1
 */
exports.updateBatch = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    const role = (req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrator" || role === "super admin" || role === "superadmin";

    if (!isAdmin && batch.createdByUserId !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (!["DRAFT", "REJECTED", "RETURNED_TO_APPLICANT"].includes(batch.status)) {
      return res.status(400).json({ success: false, message: "Batch cannot be edited in current status" });
    }

    // Validate updatable fields if present
    if (req.body.applicantEmail !== undefined) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.applicantEmail)) {
        return res.status(400).json({ success: false, message: "Invalid applicant email" });
      }
    }
    if (req.body.applicantMobile !== undefined) {
      if (!/^\d{10}$/.test(String(req.body.applicantMobile))) {
        return res.status(400).json({ success: false, message: "Applicant mobile must be 10 digits" });
      }
    }
    if (req.body.noOfPersons !== undefined) {
      const v = Number(req.body.noOfPersons);
      if (v < 0 || v > 30) {
        return res.status(400).json({ success: false, message: "Number of persons must be between 0 and 30" });
      }
    }
    if (req.body.noOfVehicles !== undefined) {
      const v = Number(req.body.noOfVehicles);
      if (v < 0 || v > 20) {
        return res.status(400).json({ success: false, message: "Number of vehicles must be between 0 and 20" });
      }
    }
    if (req.body.validityUpto !== undefined) {
      if (new Date(req.body.validityUpto) <= new Date()) {
        return res.status(400).json({ success: false, message: "Validity upto must be a future date" });
      }
    }
    if (req.body.validityFrom !== undefined && req.body.validityFrom !== null && req.body.validityFrom !== "") {
      if (isNaN(new Date(req.body.validityFrom).getTime())) {
        return res.status(400).json({ success: false, message: "Invalid validity from date" });
      }
      // Compare against the new validityUpto if provided, else the existing one
      const upto = req.body.validityUpto !== undefined ? req.body.validityUpto : batch.validityUpto;
      if (upto && new Date(req.body.validityFrom) >= new Date(upto)) {
        return res.status(400).json({ success: false, message: "Validity from must be before validity upto" });
      }
    }

    // Map the form's "purposeOfVisit" to the stored "purpose" column.
    if (req.body.purpose === undefined && req.body.purposeOfVisit !== undefined) {
      req.body.purpose = req.body.purposeOfVisit;
    }

    const updated = await BulkPassSchema.updateBatch(id, req.body);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[bulkPass] updateBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/forward  (protected — Dept User)
 * Requirements: 3.1
 */
exports.forwardToApproval = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    const role = (req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrator" || role === "super admin" || role === "superadmin";

    if (!isAdmin && batch.createdByUserId !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Applicant submissions now go directly to UNDER_REVIEW.
    // This endpoint is kept for backward compatibility — idempotent no-op.
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Batch cannot be forwarded in its current status" });
    }

    return res.status(200).json({ success: true, data: batch, message: "Batch is already under review" });
  } catch (err) {
    console.error("[bulkPass] forwardToApproval error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/return  (protected — Dept User)
 * Requirements: 3.2
 */
exports.returnToApplicant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    const { returnReason } = req.body;

    if (!returnReason || !returnReason.trim()) {
      return res.status(400).json({ success: false, message: "returnReason is required" });
    }

    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Only UNDER_REVIEW batches can be returned to applicant" });
    }

    const updated = await BulkPassSchema.setStatus(id, "RETURNED_TO_APPLICANT", {
      tokenActive: true,
      returnReason: returnReason.trim(),
      tokenExpiresAt: computeTokenExpiry(batch.linkValidityHours),
    });
    await BulkPassSchema.logTransition(id, "RETURNED_TO_APPLICANT", req.user.userId, returnReason.trim());

    // Email applicant
    sendEmail("sendBulkPassReturned", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      returnReason: returnReason.trim(),
      uploadLink: buildUploadLink(batch.token),
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      data: {
        ...updated,
        applicantEmail: batch.applicantEmail,
        uploadLink: buildUploadLink(batch.token),
      },
    });
  } catch (err) {
    console.error("[bulkPass] returnToApplicant error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/resubmit  (protected — Dept User)
 * Requirements: 9.2, 9.3
 */
exports.resubmitBatch = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }

    const role = (req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrator" || role === "super admin" || role === "superadmin";

    if (!isAdmin && batch.createdByUserId !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    if (batch.status !== "REJECTED") {
      return res.status(400).json({ success: false, message: "Only rejected batches can be resubmitted" });
    }

    const updated = await BulkPassSchema.setStatus(id, "RETURNED_TO_APPLICANT", {
      tokenActive: true,
      tokenExpiresAt: computeTokenExpiry(batch.linkValidityHours),
    });
    await BulkPassSchema.logTransition(id, "RETURNED_TO_APPLICANT", req.user.userId, "Resubmitted after rejection");
    sendEmail("sendBulkPassReturned", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      returnReason: "Please re-upload corrected Excel files.",
      uploadLink: buildUploadLink(batch.token),
    }).catch(() => {});

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[bulkPass] resubmitBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/public/:token  (public — no auth)
 * Requirements: 4.1, 4.2, 4.3
 */
exports.getPublicByToken = async (req, res) => {
  try {
    const batch = await BulkPassSchema.getByToken(getResolvedToken(req.params.token));
    if (!batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }
    if (!batch.tokenActive) {
      const expiredByTime =
        batch.tokenExpiresAt && new Date(batch.tokenExpiresAt).getTime() < Date.now();
      return res.status(403).json({
        success: false,
        message: expiredByTime
          ? "This upload link has expired. Please contact the department to resend it."
          : "Link expired or inactive",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: batch.id,
        refNo: batch.refNo,
        departmentName: batch.departmentName,
        visitorType: batch.visitorType,
        companyName: batch.companyName,
        noOfPersons: batch.noOfPersons,
        noOfVehicles: batch.noOfVehicles,
        validityFrom: batch.validityFrom,
        validityUpto: batch.validityUpto,
        purpose: batch.purpose,
        paymentMode: batch.paymentMode,
        status: batch.status,
        linkValidityHours: batch.linkValidityHours,
        tokenExpiresAt: batch.tokenExpiresAt,
      },
    });
  } catch (err) {
    console.error("[bulkPass] getPublicByToken error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/template  (public — no auth)
 * Requirements: 4.4
 */
exports.downloadTemplate = async (req, res) => {
  try {
    // Generate template on-the-fly using ExcelJS
    const ExcelJS = require("exceljs");
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Bulk Pass Template");

    // Row 1: Column headers (bold)
    const headers = [
      "S. No",
      "Name",
      "Aadhaar Number",
      "Date of Birth (DD/MM/YYYY)",
      "Mobile Number",
    ];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true, size: 11 };
    ws.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC107" }, // amber
    };
    ws.getRow(1).alignment = { vertical: "middle", wrapText: true };
    ws.getRow(1).height = 30;

    // Row 2: Example values (italic, lighter colour — acts as a visible guide row)
    ws.addRow([
      "e.g. 1",
      "e.g. John Doe",
      "e.g. 123456789012",
      "e.g. 01/01/1990",
      "e.g. 9876543210",
    ]);
    ws.getRow(2).font = { italic: true, color: { argb: "FF888888" }, size: 9 };
    ws.getRow(2).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF8E1" }, // very light amber
    };
    ws.getRow(2).height = 22;

    ws.columns = [
      { key: "sno",     width: 8 },
      { key: "name",    width: 25 },
      { key: "aadhaar", width: 20 },
      { key: "dob",     width: 22 },
      { key: "mobile",  width: 18 },
    ];

    // Add DOB data validation (date type) so Excel/Google Sheets shows date picker
    ws.getColumn("dob").eachCell({ includeEmpty: false }, (cell, rowNum) => {
      if (rowNum > 2) {
        cell.dataValidation = {
          type: "date",
          operator: "lessThan",
          formula1: "TODAY()",
          showErrorMessage: true,
          errorTitle: "Invalid Date",
          error: "Please enter a past date in DD/MM/YYYY format",
        };
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="bulk_pass_template.xlsx"');
    return res.send(buffer);
  } catch (err) {
    console.error("[bulkPass] downloadTemplate error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/public/:token/upload  (public — no auth)
 * Requirements: 4.5
 * multer is applied in the route file via the dedicated excelUpload instance.
 */
exports.uploadFiles = async (req, res) => {
  try {
    const batch = await BulkPassSchema.getByToken(getResolvedToken(req.params.token));
    if (!batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }
    if (!batch.tokenActive) {
      return res.status(403).json({ success: false, message: "Link expired or inactive" });
    }

    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ success: false, message: "No files uploaded" });
    }

    return res.status(200).json({
      success: true,
      message: `${files.length} file(s) uploaded`,
      data: files.map((f) => ({
        originalName: f.originalname,
        filePath: f.path,
        size: f.size,
      })),
    });
  } catch (err) {
    console.error("[bulkPass] uploadFiles error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/public/:token/preview  (public — no auth)
 * Requirements: 5.1–5.10, 6.1
 * Expects JSON body: { filePaths: string[], fileNames: string[] }
 */
exports.previewParsed = async (req, res) => {
  try {
    const batch = await BulkPassSchema.getByToken(getResolvedToken(req.params.token));
    if (!batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }
    if (!batch.tokenActive) {
      return res.status(403).json({ success: false, message: "Link expired or inactive" });
    }

    const { filePaths, fileNames } = req.body;
    if (!Array.isArray(filePaths) || !filePaths.length) {
      return res.status(400).json({ success: false, message: "filePaths array is required" });
    }

    // Guard: all elements must be strings
    const invalidIdx = filePaths.findIndex((p) => typeof p !== "string");
    if (invalidIdx !== -1) {
      return res.status(400).json({
        success: false,
        message: `filePaths[${invalidIdx}] is not a string — received ${typeof filePaths[invalidIdx]}. Send the filePath strings returned by the upload endpoint.`,
      });
    }

    // Enforce max 5 files (Req 4.5)
    if (filePaths.length > 5) {
      return res.status(400).json({ success: false, message: "Maximum 5 files allowed per upload session" });
    }

    const result = await parseAndValidate(filePaths, fileNames || filePaths.map((p) => path.basename(p)));
    const canSubmit = result.rows.every((r) => r.validationStatus === "valid");

    // Strip photoBuffer from response (large binary — thumbnail already included)
    const rows = result.rows.map((r) => {
      const { photoBuffer: _omit, ...rest } = r;
      return rest;
    });

    return res.status(200).json({
      success: true,
      data: {
        rows,
        summary: result.summary,
        canSubmit,
      },
    });
  } catch (err) {
    console.error("[bulkPass] previewParsed error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/public/:token/submit  (public — no auth)
 * Requirements: 7.1–7.4
 * Expects JSON body: { filePaths: string[], fileNames: string[], rows: ParsedRow[] }
 * (rows already parsed by the preview step; we re-parse to get photo buffers for storage)
 */
exports.submitBatch = async (req, res) => {
  try {
    const batch = await BulkPassSchema.getByToken(getResolvedToken(req.params.token));
    if (!batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }
    if (!batch.tokenActive) {
      return res.status(403).json({ success: false, message: "Link expired or inactive" });
    }

    if (!["DRAFT", "RETURNED_TO_APPLICANT"].includes(batch.status)) {
      return res.status(400).json({ success: false, message: "Batch is not in a submittable state" });
    }

    const { filePaths, fileNames } = req.body;
    if (!Array.isArray(filePaths) || !filePaths.length) {
      return res.status(400).json({ success: false, message: "filePaths are required for submission" });
    }
    if (filePaths.length > 5) {
      return res.status(400).json({ success: false, message: "Maximum 5 files allowed per upload session" });
    }

    // Re-parse to get photo buffers and ensure zero errors
    const parseResult = await parseAndValidate(filePaths, fileNames || filePaths.map((p) => path.basename(p)));
    if (parseResult.summary.invalid > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit: ${parseResult.summary.invalid} row(s) have validation errors`,
        data: { summary: parseResult.summary },
      });
    }

    // Enforce person count limit from batch configuration
    if (batch.noOfPersons > 0 && parseResult.rows.length > batch.noOfPersons) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit: ${parseResult.rows.length} persons exceed the allowed limit of ${batch.noOfPersons}`,
      });
    }

    // Persist photos to disk and build person records
    const uploadDir = path.join("uploads", "bulk_pass", String(batch.id));
    fs.mkdirSync(uploadDir, { recursive: true });

    const personRows = [];
    for (let i = 0; i < parseResult.rows.length; i++) {
      const row = parseResult.rows[i];
      let photoPath = null;

      if (row.photoBuffer) {
        const compressed = await compressPhotoBuffer(row.photoBuffer);
        const photoFileName = `${row.aadhaar}_${i}.jpg`;
        photoPath = path.join(uploadDir, photoFileName);
        fs.writeFileSync(photoPath, compressed);
      }

      personRows.push({
        fileName: row.fileName,
        rowNumber: row.rowNumber,
        name: row.name,
        aadhaar: row.aadhaar,
        dob: dobToISO(row.dob),
        mobile: row.mobile,
        address: row.address,
        vehicleNumber: row.vehicleNumber || null,
        vehicleType: row.vehicleType || null,
        photoPath,
        validationStatus: "valid",
        errorMessage: null,
      });
    }

    // Clear old persons from previous submission (handles re-submit after return)
    await BulkPassSchema.deletePersonsByBatch(batch.id);

    // Persist persons and uploads
    await BulkPassSchema.insertPersons(batch.id, personRows);

    for (let i = 0; i < filePaths.length; i++) {
      const fn = (fileNames && fileNames[i]) || path.basename(filePaths[i]);
      const fileRows = parseResult.rows.filter((r) => r.fileName === fn);
      await BulkPassSchema.insertUpload({
        batchId: batch.id,
        fileName: fn,
        filePath: filePaths[i],
        rowCount: fileRows.length,
      });
    }

    // Applicant submission goes DIRECTLY to Traffic (UNDER_REVIEW).
    // Bypassing department review per new requirements.
    await BulkPassSchema.setStatus(batch.id, "UNDER_REVIEW", {
      tokenActive: false,
      submittedAt: new Date().toISOString(),
    });
    await BulkPassSchema.logTransition(batch.id, "UNDER_REVIEW", null, "Applicant submitted — forwarded directly to Traffic Officer");

    // Notify applicant that submission was received and is pending department review
    sendEmail("sendBulkPassSubmitted", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      personsCount: personRows.length,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Batch submitted successfully",
      data: {
        refNo: batch.refNo,
        personsSubmitted: personRows.length,
        status: "UNDER_REVIEW",
      },
    });
  } catch (err) {
    console.error("[bulkPass] submitBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/public/:token/error-report  (public — no auth)
 * Requirements: 6.2
 * Expects query params: filePaths (comma-separated), fileNames (comma-separated)
 */
exports.downloadErrorReport = async (req, res) => {
  try {
    const batch = await BulkPassSchema.getByToken(getResolvedToken(req.params.token));
    if (!batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }

    const { filePaths: filePathsRaw, fileNames: fileNamesRaw } = req.query;
    if (!filePathsRaw) {
      return res.status(400).json({ success: false, message: "filePaths query param required" });
    }

    // Express may parse repeated query params as an array OR as a single comma-separated string
    const filePaths = Array.isArray(filePathsRaw)
      ? filePathsRaw.map((s) => s.trim()).filter(Boolean)
      : filePathsRaw.split(",").map((s) => s.trim()).filter(Boolean);

    const fileNames = fileNamesRaw
      ? (Array.isArray(fileNamesRaw)
          ? fileNamesRaw.map((s) => s.trim())
          : fileNamesRaw.split(",").map((s) => s.trim()))
      : filePaths.map((p) => path.basename(p));

    const parseResult = await parseAndValidate(filePaths, fileNames);
    const buffer = await buildErrorReport(parseResult.rows);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="bulk_pass_error_report.xlsx"');
    return res.send(buffer);
  } catch (err) {
    console.error("[bulkPass] downloadErrorReport error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/:id/pdf  (protected — Dept User / Traffic Officer)
 * Requirements: 10.1, 10.3
 */
exports.downloadPdf = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    if (batch.status !== "COMPLETED") {
      return res.status(400).json({ success: false, message: "PDF only available for COMPLETED batches" });
    }
    if (!batch.qrPdfPath) {
      return res.status(404).json({ success: false, message: "PDF not yet generated" });
    }

    const absolutePath = path.resolve(batch.qrPdfPath);
    if (!fs.existsSync(absolutePath)) {
      return res.status(404).json({ success: false, message: "PDF not yet generated" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${batch.refNo}.pdf"`);
    return res.sendFile(absolutePath);
  } catch (err) {
    console.error("[bulkPass] downloadPdf error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/approval-queue  (internal — called by approval-admin-service)
 * Returns all UNDER_REVIEW batches ordered oldest-first.
 * Requirements: 8.1
 */
exports.getApprovalQueue = async (req, res) => {
  try {
    const rows = await BulkPassSchema.listApprovalQueue();
    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error("[bulkPass] getApprovalQueue error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/:id/qr-data  (internal — called by qr-service, no user auth)
 * Returns { batch, persons } for QR/PDF generation. Mirrors the vendor
 * pass `vendor-qr-data` endpoint so the QR service can fetch without a JWT.
 */
exports.getBatchQrData = async (req, res) => {
  try {
    const id = resolveId(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    const batch = await BulkPassSchema.getById(id);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    const persons = await BulkPassSchema.getPersonsByBatch(id);
    return res.status(200).json({ success: true, data: { batch, persons } });
  } catch (err) {
    console.error("[bulkPass] getBatchQrData error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/scan/:id  (PUBLIC — no auth)
 * Returns the full, sanitized bulk pass details for an APPROVED (COMPLETED)
 * batch. This powers the page opened when ANYONE scans the bulk pass QR code.
 * Optional ?vehicle=<personId> highlights a specific vehicle entry.
 */
exports.getPublicScanData = async (req, res) => {
  try {
    const id = resolveId(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid pass ID" });

    const batch = await BulkPassSchema.getById(id);
    if (!batch) return res.status(404).json({ success: false, message: "Pass not found" });

    // Only approved (COMPLETED) passes are publicly viewable.
    if (batch.status !== "COMPLETED") {
      return res.status(403).json({ success: false, message: "This pass is not available for viewing" });
    }

    const rawPersons = await BulkPassSchema.getPersonsByBatch(id);

    // Mask Aadhaar (show last 4 digits only) for public display.
    const maskAadhaar = (a) => {
      const s = String(a || "").replace(/\s+/g, "");
      return s.length >= 4 ? `XXXX XXXX ${s.slice(-4)}` : (s || null);
    };

    const persons = (rawPersons || []).map((p) => ({
      id: p.id,
      name: p.name,
      aadhaar: maskAadhaar(p.aadhaar),
      dob: p.dob,
      mobile: p.mobile,
      vehicleNumber: p.vehicleNumber || null,
      vehicleType: p.vehicleType || null,
      inCharge: p.inCharge === true,
    }));

    const vehicles = persons
      .filter((p) => p.vehicleNumber && String(p.vehicleNumber).trim() !== "")
      .map((p) => ({
        id: p.id,
        vehicleNumber: p.vehicleNumber,
        vehicleType: p.vehicleType,
        driverName: p.name,
        mobile: p.mobile,
      }));

    return res.status(200).json({
      success: true,
      data: {
        batch: {
          id: batch.id,
          refNo: batch.refNo,
          departmentName: batch.departmentName,
          visitorType: batch.visitorType,
          companyName: batch.companyName,
          applicantMobile: batch.applicantMobile,
          noOfPersons: batch.noOfPersons,
          noOfVehicles: batch.noOfVehicles,
          purpose: batch.purpose,
          validityFrom: batch.validityFrom,
          validityUpto: batch.validityUpto,
          status: batch.status,
        },
        persons,
        vehicles,
        // Resolve the (encrypted) ?vehicle param to a plain person id so the
        // frontend can highlight the right vehicle without client-side crypto.
        highlightVehicleId: req.query.vehicle ? resolveId(req.query.vehicle) || null : null,
      },
    });
  } catch (err) {
    console.error("[bulkPass] getPublicScanData error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/approve  (called from approval-admin-service via internal call)
 * Allows approval-admin-service to set COMPLETED + store qrPdfPath.
 * Requirements: 8.2, 11.2
 */
exports.approveBatch = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    const { qrPdfPath, approvedBy } = req.body;

    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Only UNDER_REVIEW batches can be approved" });
    }

    const updated = await BulkPassSchema.setStatus(id, "COMPLETED", { qrPdfPath: qrPdfPath || null });
    await BulkPassSchema.logTransition(id, "COMPLETED", approvedBy || null, "Approved by Traffic Officer");

    sendEmail("sendBulkPassApproved", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      validityFrom: batch.validityFrom,
      validityUpto: batch.validityUpto,
      departmentName: batch.departmentName,
      // Email links to the approved-pass page; the QR itself opens bulk_pass_view.
      qrLink: FRONTEND_BASE ? `${FRONTEND_BASE}/bulk_pass_approved/${encryptToken(batch.id)}` : null,
    }).catch(() => {});

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[bulkPass] approveBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/reject  (called from approval-admin-service via internal call)
 * Requirements: 8.3
 */
exports.rejectBatch = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    const { rejectionReason, rejectedBy } = req.body;

    if (!rejectionReason || !rejectionReason.trim()) {
      return res.status(400).json({ success: false, message: "rejectionReason is required" });
    }

    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Only UNDER_REVIEW batches can be rejected" });
    }

    const updated = await BulkPassSchema.setStatus(id, "REJECTED", { rejectionReason: rejectionReason.trim() });
    await BulkPassSchema.logTransition(id, "REJECTED", rejectedBy || null, rejectionReason.trim());

    sendEmail("sendBulkPassRejected", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      rejectionReason: rejectionReason.trim(),
    }).catch(() => {});

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[bulkPass] rejectBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/public/:token/parse-excel  (public — no auth)
 * New flow: parse Excel without requiring embedded photos.
 * Returns editable rows. Photos are added separately.
 */
exports.parseExcelOnly = async (req, res) => {
  try {
    const batch = await BulkPassSchema.getByToken(getResolvedToken(req.params.token));
    if (!batch) return res.status(404).json({ success: false, message: "Invalid link" });
    if (!batch.tokenActive) return res.status(403).json({ success: false, message: "Link expired or inactive" });

    const { filePaths, fileNames } = req.body;
    if (!Array.isArray(filePaths) || !filePaths.length) {
      return res.status(400).json({ success: false, message: "filePaths array is required" });
    }
    if (filePaths.length > 5) {
      return res.status(400).json({ success: false, message: "Maximum 5 files allowed" });
    }

    const { parseExcelNoPhoto } = require("../services/excelParserService");
    const names = fileNames || filePaths.map((p) => path.basename(p));
    const rows = await parseExcelNoPhoto(filePaths, names);

    return res.status(200).json({ success: true, data: { rows, total: rows.length } });
  } catch (err) {
    console.error("[bulkPass] parseExcelOnly error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/public/:token/upload-zip  (public — no auth)
 * Accepts a zip file, extracts images, matches by serial-number filename.
 * The filename stem must be the person's serial number (row order) in the
 * template — e.g. 1.jpg, 2.jpg, 3.png — keeping the original extension.
 * Returns { matched: [{serial, photoDataUrl}], skipped: [{filename, reason}] }
 */
exports.uploadZipPhotos = async (req, res) => {
  try {
    const batch = await BulkPassSchema.getByToken(getResolvedToken(req.params.token));
    if (!batch) return res.status(404).json({ success: false, message: "Invalid link" });
    if (!batch.tokenActive) return res.status(403).json({ success: false, message: "Link expired or inactive" });

    const zipFile = req.file;
    if (!zipFile) return res.status(400).json({ success: false, message: "No zip file uploaded" });

    const { validateEmbeddedPhoto } = require("../services/photoValidationService");

    let zip;
    try {
      zip = new AdmZip(zipFile.path);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid or corrupt zip file" });
    }

    const entries = zip.getEntries();
    const matched = [];
    const skipped = [];

    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const filename = path.basename(entry.entryName);
      const ext = path.extname(filename).toLowerCase();
      if (![".jpg", ".jpeg", ".png"].includes(ext)) {
        skipped.push({ filename, reason: "Not an image file" });
        continue;
      }

      // Extract serial number from filename (stem must be a positive integer)
      const stem = path.basename(filename, ext).replace(/\s+/g, "");
      if (!/^\d+$/.test(stem) || parseInt(stem, 10) < 1) {
        skipped.push({ filename, reason: "Filename must be the serial number (e.g. 1.jpg, 2.jpg)" });
        continue;
      }

      const buffer = entry.getData();
      const validation = await validateEmbeddedPhoto(buffer);
      if (!validation.valid) {
        skipped.push({ filename, reason: validation.error });
        continue;
      }

      matched.push({
        serial: parseInt(stem, 10),
        photoDataUrl: `data:image/${ext === ".png" ? "png" : "jpeg"};base64,${buffer.toString("base64")}`,
      });
    }

    // Clean up temp zip
    try { fs.unlinkSync(zipFile.path); } catch {}

    return res.status(200).json({
      success: true,
      data: { matched, skipped, matchedCount: matched.length, skippedCount: skipped.length },
    });
  } catch (err) {
    console.error("[bulkPass] uploadZipPhotos error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/public/:token/submit-rows  (public — no auth)
 * New submit: accepts rows as JSON (with photoDataUrl per row) + optional vehicle docs.
 * Persons in req.body.rows (JSON string when multipart, or plain JSON).
 * Vehicles in req.body.vehicles (JSON string with metadata).
 * Vehicle docs as file fields: vehicle_{i}_rc, vehicle_{i}_insurance, etc.
 */
exports.submitRowsDirectly = async (req, res) => {
  try {
    const batch = await BulkPassSchema.getByToken(getResolvedToken(req.params.token));
    if (!batch) return res.status(404).json({ success: false, message: "Invalid link" });
    if (!batch.tokenActive) return res.status(403).json({ success: false, message: "Link expired or inactive" });

    if (!["DRAFT", "RETURNED_TO_APPLICANT"].includes(batch.status)) {
      return res.status(400).json({ success: false, message: "Batch is not in a submittable state" });
    }

    // rows may arrive as a JSON string (multipart) or parsed array (JSON body)
    let rows;
    if (typeof req.body.rows === "string") {
      try { rows = JSON.parse(req.body.rows); } catch { rows = []; }
    } else {
      rows = req.body.rows;
    }
    if (!Array.isArray(rows) || !rows.length) {
      return res.status(400).json({ success: false, message: "rows array is required" });
    }

    // vehicles metadata (optional)
    let vehicleMeta = [];
    if (req.body.vehicles) {
      try {
        vehicleMeta = typeof req.body.vehicles === "string"
          ? JSON.parse(req.body.vehicles)
          : req.body.vehicles;
      } catch { vehicleMeta = []; }
    }

    // Enforce person count limit from batch configuration
    if (batch.noOfPersons > 0 && rows.length > batch.noOfPersons) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit: ${rows.length} persons exceed the allowed limit of ${batch.noOfPersons}`,
      });
    }

    // Enforce vehicle count limit from batch configuration
    if (batch.noOfVehicles > 0 && vehicleMeta.length > batch.noOfVehicles) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit: ${vehicleMeta.length} vehicles exceed the allowed limit of ${batch.noOfVehicles}`,
      });
    }

    const {
      validateAadhaar, validateMobile, validateDOB,
    } = require("../utils/bulkPassValidators");
    const { validateEmbeddedPhoto } = require("../services/photoValidationService");

    // ── Validate persons ────────────────────────────────────────────────────
    const errors = [];
    const seenAadhaar = new Set();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowLabel = `Row ${i + 1}`;

      if (!row.name || !row.name.trim()) { errors.push({ index: i, message: `${rowLabel}: Name is required` }); continue; }

      const aadhaarRes = validateAadhaar(String(row.aadhaar || "").replace(/\s+/g, ""));
      if (!aadhaarRes.valid) { errors.push({ index: i, message: `${rowLabel}: ${aadhaarRes.error}` }); continue; }

      if (seenAadhaar.has(row.aadhaar)) { errors.push({ index: i, message: `${rowLabel}: Duplicate Aadhaar` }); continue; }
      seenAadhaar.add(row.aadhaar);

      const dobRes = validateDOB(row.dob || "");
      if (!dobRes.valid) { errors.push({ index: i, message: `${rowLabel}: ${dobRes.error}` }); continue; }

      const mobRes = validateMobile(String(row.mobile || ""));
      if (!mobRes.valid) { errors.push({ index: i, message: `${rowLabel}: ${mobRes.error}` }); continue; }

      if (!row.photoDataUrl) { errors.push({ index: i, message: `${rowLabel}: Photo is required` }); continue; }

      const b64Match = row.photoDataUrl.match(/^data:image\/(?:jpeg|png);base64,(.+)$/);
      if (!b64Match) { errors.push({ index: i, message: `${rowLabel}: Invalid photo format` }); continue; }

      const photoBuffer = Buffer.from(b64Match[1], "base64");
      const photoRes = await validateEmbeddedPhoto(photoBuffer);
      if (!photoRes.valid) { errors.push({ index: i, message: `${rowLabel}: ${photoRes.error}` }); continue; }
    }

    // ── In-charge validation: exactly 2 persons must be marked in-charge, and
    //    each must have an Aadhaar card document uploaded ──────────────────────
    const inChargeIndexes = rows
      .map((r, i) => (r.inCharge ? i : -1))
      .filter((i) => i !== -1);

    if (inChargeIndexes.length !== 2) {
      errors.push({
        index: -1,
        message: `Exactly 2 persons must be marked as in-charge (currently ${inChargeIndexes.length}).`,
      });
    } else {
      for (const i of inChargeIndexes) {
        const uploaded = req.files && req.files[`person_${i}_aadhaarCard`] && req.files[`person_${i}_aadhaarCard`][0];
        if (!uploaded) {
          errors.push({
            index: i,
            message: `Row ${i + 1}: Aadhaar card is required for in-charge persons`,
          });
        }
      }
    }

    if (errors.length) {
      return res.status(400).json({ success: false, message: "Validation errors", data: { errors } });
    }

    // ── Blacklist checks ────────────────────────────────────────────────────
    // Persons: hard block if any Aadhaar is BLACKLISTED / UNBLACKLIST_REQUESTED / PENDING_BLACKLIST
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const aadhaar = String(row.aadhaar || "").replace(/\s+/g, "").toUpperCase();
      if (!aadhaar) continue;
      const blRes = await pool.query(
        `SELECT id, reason, entity_type, status FROM blacklist_entries
         WHERE entity_type IN ('PERSON', 'DRIVER')
           AND identifier = $1
           AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')`,
        [aadhaar]
      );
      if (blRes.rows.length > 0) {
        const entry = blRes.rows[0];
        return res.status(403).json({
          success: false,
          message: `Submission blocked. Person in Row ${i + 1} (Aadhaar: XXXX XXXX ${aadhaar.slice(-4)}) is blacklisted as ${entry.entity_type}. Reason: ${entry.reason}`,
          data: { blacklisted: true, index: i, entity_type: entry.entity_type, reason: entry.reason }
        });
      }
    }

    // Vehicles: hard block if any vehicle reg number is BLACKLISTED / UNBLACKLIST_REQUESTED / PENDING_BLACKLIST
    for (let i = 0; i < vehicleMeta.length; i++) {
      const v = vehicleMeta[i];
      if (!v.regNo) continue;
      const normReg = v.regNo.replace(/[\s\-]/g, "").toUpperCase();
      const blRes = await pool.query(
        `SELECT id, reason, status FROM blacklist_entries
         WHERE entity_type = 'VEHICLE'
           AND REPLACE(REPLACE(UPPER(identifier), ' ', ''), '-', '') = $1
           AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')`,
        [normReg]
      );
      if (blRes.rows.length > 0) {
        const entry = blRes.rows[0];
        return res.status(403).json({
          success: false,
          message: `Submission blocked. Vehicle ${v.regNo} is blacklisted. Reason: ${entry.reason}`,
          data: { blacklisted: true, index: i, entity_type: "VEHICLE", reason: entry.reason }
        });
      }
    }
    // ── End blacklist checks ────────────────────────────────────────────────

    // ── Clear old persons from previous submission (handles re-submit after return) ──
    await BulkPassSchema.deletePersonsByBatch(batch.id);

    // ── Persist persons ─────────────────────────────────────────────────────
    const uploadDir = path.join("uploads", "bulk_pass", String(batch.id));
    fs.mkdirSync(uploadDir, { recursive: true });
    const personDocsDir = path.join(uploadDir, "aadhaar_cards");

    const personRows = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const b64 = row.photoDataUrl.replace(/^data:image\/(?:jpeg|png);base64,/, "");
      const photoBuffer = Buffer.from(b64, "base64");
      const compressed = await compressPhotoBuffer(photoBuffer);
      const photoFileName = `${String(row.aadhaar).replace(/\s+/g, "")}_${i}.jpg`;
      const photoPath = path.join(uploadDir, photoFileName);
      fs.writeFileSync(photoPath, compressed);

      // In-charge person: persist the uploaded Aadhaar card document.
      let aadhaarCardPath = null;
      if (row.inCharge) {
        const uploaded = req.files && req.files[`person_${i}_aadhaarCard`] && req.files[`person_${i}_aadhaarCard`][0];
        if (uploaded) {
          fs.mkdirSync(personDocsDir, { recursive: true });
          const destName = `${String(row.aadhaar).replace(/\s+/g, "")}_${i}_aadhaar${path.extname(uploaded.originalname)}`;
          const destPath = path.join(personDocsDir, destName);
          // copy+unlink — temp dir may be on a different filesystem (EXDEV on rename)
          fs.copyFileSync(uploaded.path, destPath);
          try { fs.unlinkSync(uploaded.path); } catch {}
          const compResult = await compressDocumentFile(destPath);
          aadhaarCardPath = compResult.path;
        }
      }

      personRows.push({
        fileName: row.fileName || "manual",
        rowNumber: i + 1,
        name: row.name.trim(),
        aadhaar: String(row.aadhaar).replace(/\s+/g, ""),
        dob: dobToISO(row.dob),
        mobile: String(row.mobile),
        address: row.address || null,
        vehicleNumber: null,
        vehicleType: null,
        photoPath,
        inCharge: row.inCharge === true,
        aadhaarCardPath,
        validationStatus: "valid",
        errorMessage: null,
      });
    }

    await BulkPassSchema.insertPersons(batch.id, personRows);

    // ── Persist vehicles ────────────────────────────────────────────────────
    const vehicleDir = path.join("uploads", "bulk_pass", String(batch.id), "vehicles");
    if (vehicleMeta.length > 0) {
      fs.mkdirSync(vehicleDir, { recursive: true });
    }

    const vehicleRows = [];
    for (let i = 0; i < vehicleMeta.length; i++) {
      const v = vehicleMeta[i];
      if (!v.regNo) continue;

      // Move uploaded doc files to permanent location and compress to ≤ 5 MB
      const docFields = ["rc", "insurance", "fitness", "permit", "roadTax", "emission"];
      const docPaths = {};
      for (const field of docFields) {
        const fileKey = `vehicle_${i}_${field}`;
        const uploaded = req.files && req.files[fileKey] && req.files[fileKey][0];
        if (uploaded) {
          const destName = `${v.regNo.replace(/\s+/g, "_")}_${field}${path.extname(uploaded.originalname)}`;
          const destPath = path.join(vehicleDir, destName);
          // Use copy+unlink instead of rename: the temp dir (/tmp) is often on a
          // different filesystem than uploads/, and rename across devices throws EXDEV.
          fs.copyFileSync(uploaded.path, destPath);
          try { fs.unlinkSync(uploaded.path); } catch {}

          // Compress document image to ≤ 5 MB (never rejects)
          const compResult = await compressDocumentFile(destPath);
          docPaths[field] = compResult.path;
        }
      }

      vehicleRows.push({
        fileName: "vehicle_manual",
        rowNumber: personRows.length + i + 1,
        name: v.driverName ? v.driverName.trim() : v.regNo.trim(),
        aadhaar: v.driverAadhaar ? String(v.driverAadhaar).replace(/\s+/g, "") : "",
        dob: dobToISO(v.driverDob),
        mobile: v.driverMobile ? String(v.driverMobile) : null,
        address: null,
        vehicleNumber: v.regNo.trim(),
        vehicleType: v.vehicleType || null,
        photoPath: docPaths.rc || null,
        // Persist every uploaded document path so all of them can be viewed later.
        vehicleDocs: Object.keys(docPaths).length > 0 ? docPaths : null,
        validationStatus: "valid",
        errorMessage: null,
      });
    }

    if (vehicleRows.length > 0) {
      await BulkPassSchema.insertPersons(batch.id, vehicleRows);
    }

    // Applicant submission goes DIRECTLY to Traffic (UNDER_REVIEW).
    // Bypassing department review per new requirements.
    await BulkPassSchema.setStatus(batch.id, "UNDER_REVIEW", {
      tokenActive: false,
      submittedAt: new Date().toISOString(),
    });
    await BulkPassSchema.logTransition(batch.id, "UNDER_REVIEW", null, "Applicant submitted — forwarded directly to Traffic Officer");

    sendEmail("sendBulkPassSubmitted", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      personsCount: personRows.length,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Batch submitted successfully",
      data: {
        refNo: batch.refNo,
        personsSubmitted: personRows.length,
        vehiclesSubmitted: vehicleRows.length,
        status: "UNDER_REVIEW",
      },
    });
  } catch (err) {
    console.error("[bulkPass] submitRowsDirectly error:", err.stack || err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};