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

/**
 * Centralized error handler for the Bulk Pass module.
 * Formats diagnostic error messages clearly so API clients and UI forms get
 * actionable error descriptions rather than generic internal server errors.
 */
const handleBulkPassError = (res, err, contextMessage = "Bulk pass processing error", statusCode = 500) => {
  console.error(`[bulkPassController] ${contextMessage}:`, err.stack || err.message || err);
  const detailedMessage = err.message ? `${contextMessage}: ${err.message}` : contextMessage;
  return res.status(statusCode).json({
    success: false,
    message: detailedMessage,
    errorDetails: err.message || null,
    code: err.code || null,
  });
};

// Returns true when a batch's upload link should be treated as expired.
// A link is expired when the tokenActive flag has been cleared (e.g. after
// submission) OR when the time-based expiry window has passed.
const isLinkExpired = (batch) =>
  !batch.tokenActive ||
  (batch.tokenExpiresAt && new Date(batch.tokenExpiresAt).getTime() < Date.now());

/**
 * Resolves a token parameter to a target batch or parent request.
 */
const findBatchOrParentRequestByToken = async (token) => {
  if (!token) return null;

  // 1. First check bulk_pass_batches
  let batch = await BulkPassSchema.getByToken(token);
  if (batch) {
    return { batch, isParentRequest: false, parentRequest: null };
  }

  // 2. Fall back to bulk_pass_parent_requests (public website requests)
  const BulkPassParentRequest = require("../models/BulkPassParentRequest");
  const parentRequest = await BulkPassParentRequest.findByToken(token);

  if (parentRequest) {
    let expiredByTime = false;
    if (parentRequest.approved_time_upto) {
      const upto = new Date(parentRequest.approved_time_upto);
      if (upto.getHours() === 0 && upto.getMinutes() === 0 && upto.getSeconds() === 0) {
        upto.setHours(23, 59, 59, 999);
      }
      expiredByTime = upto.getTime() < Date.now();
    }

    const formattedBatch = {
      id: parentRequest.id,
      refNo: parentRequest.tracking_number,
      departmentId: null,
      departmentName: "General Administration",
      visitorType: parentRequest.visitor_type,
      companyName: parentRequest.company_name,
      applicantEmail: parentRequest.applicant_email,
      applicantMobile: parentRequest.applicant_mobile,
      noOfPersons: parentRequest.no_of_persons,
      noOfVehicles: parentRequest.no_of_vehicles,
      validityFrom: parentRequest.approved_time_from || parentRequest.validity_from,
      validityUpto: parentRequest.approved_time_upto || parentRequest.validity_upto,
      purpose: parentRequest.purpose,
      paymentMode: parentRequest.payment_mode || "CASH",
      status: parentRequest.status === "ACTIVE" ? "DRAFT" : parentRequest.status,
      tokenActive: parentRequest.token_active && !expiredByTime,
      tokenExpiresAt: parentRequest.approved_time_upto,
      multipleSubmissionsEnabled: true,
      request_source: "PUBLIC_WEBSITE",
      isParentRequest: true,
    };

    return { batch: formattedBatch, isParentRequest: true, parentRequest };
  }

  return null;
};

// Resolve an encrypted-or-numeric id param to a Number (NaN if unresolvable).
const resolveId = (idOrHash) => {
  if (!idOrHash) return NaN;
  const decrypted = decryptToken(idOrHash);
  const resolved = decrypted || idOrHash;
  return Number(resolved);
};



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
    const detail = err.response?.data
      ? JSON.stringify(err.response.data)
      : err.message;
    console.error(`[bulkPass] Email send failed (${endpoint}): status=${err.response?.status ?? "N/A"} — ${detail}`);
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
    multipleSubmissionsEnabled,
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

  // Validate multipleSubmissionsEnabled if provided
  if (multipleSubmissionsEnabled !== undefined && multipleSubmissionsEnabled !== null) {
    if (typeof multipleSubmissionsEnabled !== 'boolean' && multipleSubmissionsEnabled !== 'true' && multipleSubmissionsEnabled !== 'false') {
      return { ok: false, status: 400, message: "Invalid multipleSubmissionsEnabled value" };
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

/**
 * POST /api/bulk-pass/public/vehicle-check
 * Public endpoint — no auth required. Used by the applicant upload form to
 * check RC validity, insurance expiry, fitness expiry, etc. via ULIP VAHAN/04.
 * Body: { vehiclenumber: "TN01AB1234" }
 */
exports.publicVehicleCheck = async (req, res) => {
  try {
    const { vehiclenumber } = req.body;
    if (!vehiclenumber || typeof vehiclenumber !== "string") {
      return res.status(400).json({ success: false, message: "vehiclenumber is required" });
    }

    const reg = vehiclenumber.replace(/[\s\-]/g, "").toUpperCase();
    if (!/^[A-Z0-9]{5,11}$/.test(reg)) {
      return res.status(400).json({ success: false, message: "Invalid vehicle number format" });
    }

    const ulipService = require("../services/ulipService");
    const data = await ulipService.verifyVehicle(reg);

    // VAHAN/04 returns data inside response[0].response (JSON) when vehicle exists
    const vd = data?.response?.[0]?.response;
    if (!vd || data?.response?.[0]?.responseStatus === "ERROR") {
      return res.json({ success: true, found: false, message: "Vehicle not found in VAHAN database" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper: parse ULIP date strings like "25-Jan-2032" or "25-01-2032"
    // Must parse as local date (not UTC) to avoid off-by-one due to timezone shift.
    const parseUlipDate = (str) => {
      if (!str || typeof str !== "string") return null;
      const s = str.trim();
      // "DD-Mon-YYYY" e.g. "04-Aug-2025"
      const namedMonth = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
      if (namedMonth) {
        const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
        const mo = months[namedMonth[2]];
        if (mo === undefined) return null;
        return new Date(+namedMonth[3], mo, +namedMonth[1]);
      }
      // "DD-MM-YYYY" e.g. "25-01-2032"
      const numericDMY = s.match(/^(\d{1,2})-(\d{2})-(\d{4})$/);
      if (numericDMY) {
        return new Date(+numericDMY[3], +numericDMY[2] - 1, +numericDMY[1]);
      }
      // "YYYY-MM-DD" ISO format fallback — parse as local date
      const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (iso) {
        return new Date(+iso[1], +iso[2] - 1, +iso[3]);
      }
      return null;
    };

    // Collect all validity fields that exist in the response
    const validityChecks = [
      { label: "RC Registration",     date: parseUlipDate(vd.rcRegnUpto),          field: "rcRegnUpto"        },
      { label: "Insurance",           date: parseUlipDate(vd.rcInsuranceUpto),      field: "rcInsuranceUpto"   },
      { label: "Fitness Certificate", date: parseUlipDate(vd.rcFitUpto),            field: "rcFitUpto"         },
      { label: "Tax",                 date: parseUlipDate(vd.rcTaxUpto),            field: "rcTaxUpto"         },
      { label: "PUCC/Emission",       date: parseUlipDate(vd.rcPuccUpto),           field: "rcPuccUpto"        },
    ].filter((c) => c.date !== null); // only include fields present in the response

    const expired = validityChecks.filter((c) => c.date < today);
    const valid   = validityChecks.filter((c) => c.date >= today);

    // RC status check
    const rcStatus = (vd.rcStatus || "").toUpperCase();
    const rcActive = rcStatus === "ACTIVE" || rcStatus === "";

    return res.json({
      success: true,
      found: true,
      rcStatus: vd.rcStatus || null,
      rcActive,
      validityChecks: validityChecks.map((c) => ({
        label: c.label,
        date: c.date.toISOString().split("T")[0],
        expired: c.date < today,
      })),
      expired: expired.map((c) => ({
        label: c.label,
        date: c.date.toISOString().split("T")[0],
      })),
      allValid: expired.length === 0 && rcActive,
    });
  } catch (err) {
    console.error("[bulkPass] publicVehicleCheck error:", err.message || err);
    // Don't block the form if ULIP is down — return a graceful degradation
    return res.status(503).json({
      success: false,
      message: "Vehicle verification service is temporarily unavailable. Please try again.",
    });
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
    // ── Department restriction ─────────────────────────────────────────────
    // Only General Administration (6) and Traffic sub-departments (9–15) are
    // allowed to create bulk passes. Admins/super-admins bypass this check.
    const BULK_PASS_ALLOWED_DEPT_IDS = [6, 9, 10, 11, 12, 13, 14, 15];
    const creatorRole = (req.user?.role || "").toLowerCase();
    const isAdmin =
      creatorRole === "admin" ||
      creatorRole === "administrator" ||
      creatorRole === "super admin" ||
      creatorRole === "superadmin";

    if (!isAdmin && !BULK_PASS_ALLOWED_DEPT_IDS.includes(Number(req.user?.departmentId))) {
      return res.status(403).json({
        success: false,
        message: "Only General Administration and Traffic departments are permitted to create bulk passes.",
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

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
      multipleSubmissionsEnabled,
    } = req.body;

    // The create forms submit "purposeOfVisit"; accept it as a fallback for "purpose".
    const resolvedPurpose = purpose || purposeOfVisit || "";

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
        tokenExpiresAt: validityUpto,
        multipleSubmissionsEnabled: multipleSubmissionsEnabled === true || multipleSubmissionsEnabled === "true",
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

    // Allow resend if tokenActive is true OR if the link has simply expired by time
    // (admin wants to issue a fresh window). If tokenActive is false because the
    // applicant already submitted, the batch status would be UNDER_REVIEW/COMPLETED
    // which is caught by the status check above — so reaching here with
    // tokenActive=false means the link timed out and a resend is appropriate.
    const expiredByTime =
      batch.tokenExpiresAt && new Date(batch.tokenExpiresAt).getTime() < Date.now();
    if (!batch.tokenActive && !expiredByTime) {
      return res.status(400).json({ success: false, message: "Upload link is no longer active. Use Return to Applicant to issue a new link." });
    }

    // Refresh the link's validity window so the applicant gets a fresh
    // window aligned with the pass validity upto.
    const newExpiry = batch.validityUpto;

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
    });

    if (!sent) {
      return res.status(503).json({ success: false, message: "Failed to send invitation email. The email service may be unavailable — please try again shortly." });
    }

    // Update lastEmailSentAt, refresh the link expiry window, and reactivate
    // the token if it expired by time (so the new expiry window is honoured).
    await BulkPassSchema.setStatus(batch.id, batch.status, {
      lastEmailSentAt: new Date().toISOString(),
      tokenExpiresAt: newExpiry,
      tokenActive: true,
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
 * Requirements: 2.1, 2.2, 18.1
 */
exports.listBatches = async (req, res) => {
  try {
    const { refNo, companyName, status, fromDate, toDate, search, multipleSubmissionsEnabled } = req.query;

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
      multipleSubmissionsEnabled: multipleSubmissionsEnabled === 'true' ? true : undefined,
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
      tokenExpiresAt: batch.validityUpto,
    });
    await BulkPassSchema.logTransition(id, "RETURNED_TO_APPLICANT", req.user.userId, returnReason.trim());

    // Email applicant — log failures but don't block the response
    const emailSent = await sendEmail("sendBulkPassReturned", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      returnReason: returnReason.trim(),
      uploadLink: buildUploadLink(batch.token),
    });
    if (!emailSent) {
      console.error(`[bulkPass] returnToApplicant: failed to send returned email for batch ${id} (${batch.refNo}) to ${batch.applicantEmail}`);
    }

    return res.status(200).json({
      success: true,
      emailSent,
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
      tokenExpiresAt: batch.validityUpto,
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
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }
    const { batch, isParentRequest, parentRequest } = resolved;
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

    // Base response fields
    const responseData = {
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
    };

    // When this link was sent for revision, include the return reason and any
    // previously submitted persons/vehicles so the applicant can review and
    // correct their data without starting from scratch.
    if (batch.status === "RETURNED_TO_APPLICANT") {
      responseData.returnReason = batch.returnReason || null;
      const previousPersons = await BulkPassSchema.getPersonsByBatch(batch.id);
      // Separate persons from vehicle rows (vehicles have a vehicleNumber)
      const personRows = previousPersons.filter(
        (p) => !p.vehicleNumber || p.vehicleNumber.trim() === ""
      );
      const vehicleRows = previousPersons.filter(
        (p) => p.vehicleNumber && p.vehicleNumber.trim() !== ""
      );
      responseData.previousPersons = personRows.map((p) => ({
        id: p.id,
        name: p.name || "",
        aadhaar: p.aadhaar || "",
        dob: p.dob
          ? (() => {
              // Convert stored YYYY-MM-DD back to DD/MM/YYYY for the form
              const parts = String(p.dob).split("T")[0].split("-");
              return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : p.dob;
            })()
          : "",
        mobile: p.mobile || "",
        photoPath: p.photoPath || null,   // existing server-side path (display only, not re-uploaded)
        aadhaarCardPath: p.aadhaarCardPath || null, // must be re-uploaded by applicant
        approvalStatus: p.approvalStatus || "PENDING",
        approvalReason: p.approvalReason || null,
      }));
      responseData.previousVehicles = vehicleRows.map((v) => ({
        id: v.id,
        regNo: v.vehicleNumber || "",
        vehicleType: v.vehicleType || "",
        driverName: v.name || "",
        driverAadhaar: v.aadhaar || "",
        driverMobile: v.mobile || "",
        driverDob: v.dob
          ? (() => {
              const parts = String(v.dob).split("T")[0].split("-");
              return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : v.dob;
            })()
          : "",
        driverLicenseNumber: v.driverLicenseNumber || "",
        vehicleDocs: v.vehicleDocs || {},  // existing doc paths (must be re-uploaded)
        approvalStatus: v.approvalStatus || "PENDING",
        approvalReason: v.approvalReason || null,
      }));
    }

    return res.status(200).json({ success: true, data: responseData });
  } catch (err) {
    console.error("[bulkPass] getPublicByToken error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/validate-token/:token  (public — no auth)
 * Requirements: 8.1-8.6, 3.2-3.5, 7.1-7.2
 * 
 * Enhanced token validation controller that handles:
 * - bulk_pass_parent_requests (public request workflow)
 * - bulk_pass_batches with multipleSubmissionsEnabled=true (department)
 * - bulk_pass_batches with multipleSubmissionsEnabled=false (single submission)
 */
exports.validateToken = async (req, res) => {
  try {
    const token = getResolvedToken(req.params.token);
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    // ── Step 1: Check if token belongs to bulk_pass_parent_requests (public request workflow) ──
    const BulkPassParentRequest = require("../models/BulkPassParentRequest");
    const parentRequest = await BulkPassParentRequest.findByToken(token);

    if (parentRequest && parentRequest.token_active) {
      // Validate current time is within approved_time_from and approved_time_upto
      const now = new Date();
      const approvedFrom = parentRequest.approved_time_from ? new Date(parentRequest.approved_time_from) : null;
      const approvedUpto = parentRequest.approved_time_upto ? new Date(parentRequest.approved_time_upto) : null;

      // Check if expired
      if (approvedUpto) {
        if (approvedUpto.getHours() === 0 && approvedUpto.getMinutes() === 0 && approvedUpto.getSeconds() === 0) {
          approvedUpto.setHours(23, 59, 59, 999);
        }
        if (now > approvedUpto) {
          return res.status(403).json({
            success: false,
            message: "The submission period has expired",
          });
        }
      }

      // Check if not yet started
      if (approvedFrom && now < approvedFrom) {
        return res.status(403).json({
          success: false,
          message: "The submission period has not started yet",
        });
      }

      // Get submission history
      const submissionHistory = await BulkPassSchema.getChildBatches(parentRequest.id, 'PUBLIC_WEBSITE');
      const nextSubmissionNumber = await BulkPassSchema.getNextSubmissionNumber(parentRequest.id, 'PUBLIC_WEBSITE');

      return res.status(200).json({
        success: true,
        data: {
          isParentRequest: true,
          isParentBatch: false,
          withinValidityPeriod: true,
          parentRequest: {
            id: parentRequest.id,
            trackingNumber: parentRequest.tracking_number,
            companyName: parentRequest.company_name,
            applicantEmail: parentRequest.applicant_email,
            applicantMobile: parentRequest.applicant_mobile,
            visitorType: parentRequest.visitor_type,
            noOfPersons: parentRequest.no_of_persons,
            noOfVehicles: parentRequest.no_of_vehicles,
            paymentMode: parentRequest.payment_mode,
            purpose: parentRequest.purpose,
            validityFrom: parentRequest.validity_from,
            validityUpto: parentRequest.validity_upto,
            approvedTimeFrom: parentRequest.approved_time_from,
            approvedTimeUpto: parentRequest.approved_time_upto,
            workOrderRequired: parentRequest.work_order_required,
            refDocNo: parentRequest.ref_doc_no,
            remarks: parentRequest.remarks,
            status: parentRequest.status,
          },
          submissionHistory,
          nextSubmissionNumber,
        },
      });
    }

    // ── Step 2: Check if token belongs to bulk_pass_batches ──
    const batch = await BulkPassSchema.getByToken(token);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Invalid or inactive token",
      });
    }

    // Check if token is active
    if (!batch.tokenActive) {
      return res.status(403).json({
        success: false,
        message: "Link expired or inactive",
      });
    }

    // ── Step 3: Check if multipleSubmissionsEnabled is true ──
    if (batch.multipleSubmissionsEnabled) {
      // Validate current time is within validityFrom and validityUpto
      const now = new Date();
      const validityFrom = batch.validityFrom ? new Date(batch.validityFrom) : null;
      const validityUpto = batch.validityUpto ? new Date(batch.validityUpto) : null;

      // Check if expired
      if (validityUpto && now > validityUpto) {
        return res.status(403).json({
          success: false,
          message: "The submission period has expired",
        });
      }

      // Check if not yet started
      if (validityFrom && now < validityFrom) {
        return res.status(403).json({
          success: false,
          message: "The submission period has not started yet",
        });
      }

      // Get submission history
      const submissionHistory = await BulkPassSchema.getChildBatches(batch.id, 'DEPARTMENT');
      const nextSubmissionNumber = await BulkPassSchema.getNextSubmissionNumber(batch.id, 'DEPARTMENT');

      return res.status(200).json({
        success: true,
        data: {
          isParentRequest: false,
          isParentBatch: true,
          withinValidityPeriod: true,
          batch: {
            id: batch.id,
            refNo: batch.refNo,
            departmentId: batch.departmentId,
            departmentName: batch.departmentName,
            visitorType: batch.visitorType,
            companyName: batch.companyName,
            applicantEmail: batch.applicantEmail,
            applicantMobile: batch.applicantMobile,
            noOfPersons: batch.noOfPersons,
            noOfVehicles: batch.noOfVehicles,
            paymentMode: batch.paymentMode,
            purpose: batch.purpose,
            validityFrom: batch.validityFrom,
            validityUpto: batch.validityUpto,
            workOrderRequired: batch.workOrderRequired,
            refDocNo: batch.refDocNo,
            remarks: batch.remarks,
            status: batch.status,
            multipleSubmissionsEnabled: batch.multipleSubmissionsEnabled,
          },
          submissionHistory,
          nextSubmissionNumber,
        },
      });
    }

    // ── Step 4: multipleSubmissionsEnabled is false (existing single-submission behavior) ──
    return res.status(200).json({
      success: true,
      data: {
        isParentRequest: false,
        isParentBatch: false,
        withinValidityPeriod: true,
        batch: {
          id: batch.id,
          refNo: batch.refNo,
          departmentId: batch.departmentId,
          departmentName: batch.departmentName,
          visitorType: batch.visitorType,
          companyName: batch.companyName,
          applicantEmail: batch.applicantEmail,
          applicantMobile: batch.applicantMobile,
          noOfPersons: batch.noOfPersons,
          noOfVehicles: batch.noOfVehicles,
          paymentMode: batch.paymentMode,
          purpose: batch.purpose,
          validityFrom: batch.validityFrom,
          validityUpto: batch.validityUpto,
          workOrderRequired: batch.workOrderRequired,
          refDocNo: batch.refDocNo,
          remarks: batch.remarks,
          status: batch.status,
          multipleSubmissionsEnabled: batch.multipleSubmissionsEnabled,
          linkValidityHours: batch.linkValidityHours,
          tokenExpiresAt: batch.tokenExpiresAt,
        },
      },
    });
  } catch (err) {
    console.error("[bulkPass] validateToken error:", err.message);
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
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }
    const { batch } = resolved;
    if (isLinkExpired(batch)) {
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
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }
    const { batch } = resolved;
    if (isLinkExpired(batch)) {
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
    const token = getResolvedToken(req.params.token);
    
    // Parse multipart/form-data: excel_file, persons array, vehicles array, document files
    const { filePaths, fileNames, persons = [], vehicles = [] } = req.body;
    
    // Validate maximum limits (Req 9.1-9.11, 3.3, 15.1)
    if (persons.length > 30) {
      return res.status(400).json({ 
        success: false, 
        message: "Maximum 30 persons allowed per submission" 
      });
    }
    
    if (vehicles.length > 20) {
      return res.status(400).json({ 
        success: false, 
        message: "Maximum 20 vehicles allowed per submission" 
      });
    }
    
    // **Step 1**: Identify parent (parent request or parent batch)
    let parentRequest = null;
    let parentBatch = null;
    let isPublicRequest = false;
    
    // Check bulk_pass_parent_requests by shared_token
    const BulkPassParentRequest = require("../models/BulkPassParentRequest");
    parentRequest = await BulkPassParentRequest.findByToken(token);
    
    if (parentRequest) {
      isPublicRequest = true;
    } else {
      // Check bulk_pass_batches by token where multipleSubmissionsEnabled=true
      parentBatch = await BulkPassSchema.getByToken(token);
      
      if (parentBatch && !parentBatch.multipleSubmissionsEnabled) {
        // Single submission batch - use original logic
        return handleSingleSubmissionBatch(req, res, parentBatch);
      }
      
      if (!parentBatch) {
        return res.status(400).json({ 
          success: false, 
          message: "Invalid token. Parent batch or request not found." 
        });
      }
    }
    
    // Determine parent for remaining steps
    const parent = parentRequest || parentBatch;
    
    // **Step 2**: Validate validity period
    const validityFrom = parent.validityFrom || parent.approved_time_from;
    const validityUpto = parent.validityUpto || parent.approved_time_upto;
    
    const now = Date.now();
    const validityUptoTime = validityUpto ? new Date(validityUpto).getTime() : null;
    
    if (!validityUptoTime || now > validityUptoTime) {
      return res.status(403).json({ 
        success: false, 
        message: "The submission period has expired" 
      });
    }
    
    // **Step 3**: Validate blacklist
    const aadhaarNumbers = persons.map(p => String(p.aadhaarNo || p.aadhaar).replace(/\s+/g, "").toUpperCase()).filter(Boolean);
    const vehicleNumbers = vehicles.map(v => String(v.registrationNo || v.vehicleNumber).replace(/[\s\-]/g, "").toUpperCase()).filter(Boolean);
    
    // Check Aadhaar numbers against blacklist
    if (aadhaarNumbers.length > 0) {
      const blacklistedPersons = await pool.query(
        `SELECT identifier, reason, reason_code FROM blacklist_entries
         WHERE entity_type IN ('PERSON', 'DRIVER')
           AND identifier = ANY($1)
           AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')`,
        [aadhaarNumbers]
      );
      
      if (blacklistedPersons.rows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "One or more persons are blacklisted",
          blacklisted: blacklistedPersons.rows.map(r => ({
            identifier: r.identifier,
            reason: r.reason,
            reasonCode: r.reason_code
          }))
        });
      }
    }
    
    // Check vehicle registration numbers against blacklist
    if (vehicleNumbers.length > 0) {
      const blacklistedVehicles = await pool.query(
        `SELECT identifier, reason, reason_code FROM blacklist_entries
         WHERE entity_type = 'VEHICLE'
           AND REPLACE(REPLACE(UPPER(identifier), ' ', ''), '-', '') = ANY($1)
           AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')`,
        [vehicleNumbers]
      );
      
      if (blacklistedVehicles.rows.length > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "One or more vehicles are blacklisted",
          blacklisted: blacklistedVehicles.rows.map(r => ({
            identifier: r.identifier,
            reason: r.reason,
            reasonCode: r.reason_code
          }))
        });
      }
    }
    
    // **Step 4**: Get next submission number using getNextSubmissionNumber helper
    const submissionNumber = isPublicRequest
      ? await BulkPassSchema.getNextSubmissionNumber(parentRequest.id, 'PUBLIC_WEBSITE')
      : await BulkPassSchema.getNextSubmissionNumber(parentBatch.id, 'DEPARTMENT');
    
    // **Step 5**: Generate new reference number (format: BP/YYYY/NNNNN)
    const client = await pool.connect();
    let childRefNo;
    try {
      childRefNo = await ReferenceNumber.generateBulkPassReference(client);
    } finally {
      client.release();
    }
    
    // **Step 6**: Create child batch record
    const childBatchData = {
      refNo: childRefNo,
      token: buildToken(),
      tokenActive: true,
      status: 'UNDER_REVIEW',
      multipleSubmissionsEnabled: false,
      parent_request_id: parent.id,
      submission_number: submissionNumber,
      request_source: isPublicRequest ? 'PUBLIC_WEBSITE' : 'DEPARTMENT',
      
      // Inherit from parent
      companyName: parent.companyName || parent.company_name,
      applicantEmail: parent.applicantEmail || parent.applicant_email,
      applicantMobile: parent.applicantMobile || parent.applicant_mobile,
      validityFrom: validityFrom,
      validityUpto: validityUpto,
      departmentId: parent.departmentId || 6, // Default to General Admin for public requests
      paymentMode: parent.paymentMode || parent.payment_mode,
      purpose: parent.purpose,
      workOrderRequired: parent.workOrderRequired || parent.work_order_required || false,
      refDocNo: parent.refDocNo || parent.ref_doc_no,
      remarks: parent.remarks,
      
      // Set from current submission
      noOfPersons: persons.length,
      noOfVehicles: vehicles.length,
      
      // Additional required fields
      createdByUserId: parentBatch?.createdByUserId || null,
      departmentName: parentBatch?.departmentName || 'General Administrator',
      visitorType: parentBatch?.visitorType || parent.visitor_type || 'VENDOR',
      linkValidityHours: 48,
      tokenExpiresAt: null // Not applicable for child batches
    };
    
    const childBatch = await BulkPassSchema.createBatch(childBatchData);
    
    // **Step 7**: Upload files to TOS service and get file paths
    // (In current implementation, files are already uploaded via uploadMiddleware)
    // File paths are in filePaths array
    
    // **Step 8**: Insert person records with batch_id = child batch ID
    if (!Array.isArray(filePaths) || !filePaths.length) {
      return res.status(400).json({ success: false, message: "filePaths are required for submission" });
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
    
    // Persist photos to disk and build person records
    const uploadDir = path.join("uploads", "bulk_pass", String(childBatch.id));
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
    
    await BulkPassSchema.insertPersons(childBatch.id, personRows);
    
    // **Step 9**: Insert vehicle records with batch_id = child batch ID
    // (Vehicles are included in persons table via vehicleNumber field in current implementation)
    
    // **Step 10**: Insert bulk_pass_uploads records
    for (let i = 0; i < filePaths.length; i++) {
      const fn = (fileNames && fileNames[i]) || path.basename(filePaths[i]);
      const fileRows = parseResult.rows.filter((r) => r.fileName === fn);
      await BulkPassSchema.insertUpload({
        batchId: childBatch.id,
        fileName: fn,
        filePath: filePaths[i],
        rowCount: fileRows.length,
      });
    }
    
    // Log status transition
    await BulkPassSchema.logTransition(
      childBatch.id, 
      "UNDER_REVIEW", 
      null, 
      `Child submission #${submissionNumber} created — forwarded to Traffic Officer`
    );
    
    // **Step 11**: Keep parent token active (DO NOT deactivate)
    // Token remains active for future submissions
    
    // **Step 12**: Send confirmation email via email service
    sendEmail("sendChildBatchConfirmation", {
      email: childBatch.applicantEmail,
      refNo: childBatch.refNo,
      submissionNumber: submissionNumber,
      companyName: childBatch.companyName,
      personsCount: personRows.length,
      vehiclesCount: vehicles.length
    }).catch(() => {});
    
    // Calculate next submission number and check if can submit more
    const nextSubmissionNumber = submissionNumber + 1;
    const canSubmitMore = now < validityUptoTime;
    
    return res.status(201).json({
      success: true,
      message: "Submission successful",
      childBatch: {
        id: childBatch.id,
        refNo: childBatch.refNo,
        submissionNumber: submissionNumber,
        status: childBatch.status
      },
      canSubmitMore: canSubmitMore,
      nextSubmissionNumber: nextSubmissionNumber
    });
    
  } catch (err) {
    console.error("[bulkPass] submitBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Helper function to handle single-submission batch logic
 * (Original submitBatch behavior)
 */
async function handleSingleSubmissionBatch(req, res, batch) {
  try {
    if (isLinkExpired(batch)) {
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
    console.error("[bulkPass] handleSingleSubmissionBatch error:", err.message);
    throw err;
  }
}

/**
 * GET /api/bulk-pass/public/:token/error-report  (public — no auth)
 * Requirements: 6.2
 * Expects query params: filePaths (comma-separated), fileNames (comma-separated)
 */
exports.downloadErrorReport = async (req, res) => {
  try {
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) {
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
 * POST /api/bulk-pass/:id/update-pdf-path  (internal — called by approval-admin-service)
 * Updates qrPdfPath on an already-COMPLETED batch (e.g. after on-demand PDF regeneration).
 */
exports.updatePdfPath = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });

    const { qrPdfPath } = req.body;
    if (!qrPdfPath || typeof qrPdfPath !== "string") {
      return res.status(400).json({ success: false, message: "qrPdfPath is required" });
    }

    const batch = await BulkPassSchema.getById(id);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    if (batch.status !== "COMPLETED") {
      return res.status(400).json({ success: false, message: "Only COMPLETED batches can have their PDF path updated" });
    }

    await BulkPassSchema.setStatus(id, "COMPLETED", { qrPdfPath });
    return res.status(200).json({ success: true, message: "PDF path updated" });
  } catch (err) {
    console.error("[bulkPass] updatePdfPath error:", err.message);
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
 * Returns { batch, persons } for QR/PDF generation. Only APPROVED persons are
 * included so that rejected persons never appear in the generated pass.
 * Mirrors the vendor pass `vendor-qr-data` endpoint so the QR service can
 * fetch without a JWT.
 */
exports.getBatchQrData = async (req, res) => {
  try {
    const id = resolveId(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    const batch = await BulkPassSchema.getById(id);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    // Return only APPROVED persons so QR generation never includes rejected ones.
    const persons = await BulkPassSchema.getApprovedPersonsByBatch(id);
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

    // Check if the pass validity period has passed.
    if (batch.validityUpto && new Date(batch.validityUpto).getTime() < Date.now()) {
      return res.status(403).json({
        success: false,
        message: "This pass has expired.",
        data: {
          expired: true,
          refNo: batch.refNo,
          validityUpto: batch.validityUpto,
        },
      });
    }

    const rawPersons = await BulkPassSchema.getPersonsByBatch(id);

    // Mask Aadhaar (show last 4 digits only) for public display.
    const maskAadhaar = (a) => {
      const s = String(a || "").replace(/\s+/g, "");
      return s.length >= 4 ? `XXXX XXXX ${s.slice(-4)}` : (s || null);
    };

    // Only show APPROVED persons and vehicles in the public pass view.
    // Rejected persons should not be visible to the gate or the applicant.
    const persons = (rawPersons || [])
      .filter((p) => {
        // Vehicles (rows with vehicleNumber) don't go through individual approval —
        // include them as long as the batch itself is COMPLETED.
        if (p.vehicleNumber && String(p.vehicleNumber).trim() !== "") return true;
        // Persons must be explicitly APPROVED.
        return p.approvalStatus === "APPROVED";
      })
      .map((p) => ({
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

    // Use actual approved counts so the view page shows accurate numbers,
    // not the originally declared estimates.
    const approvedPersonCount = persons.filter((p) => !p.vehicleNumber).length;
    const approvedVehicleCount = vehicles.length;

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
          noOfPersons: approvedPersonCount,
          noOfVehicles: approvedVehicleCount,
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
 * POST /api/bulk-pass/:batchId/persons/:personId/approve  (internal — called by approval-admin-service)
 * Approve a single person within a bulk batch.
 */
exports.approvePersonInBatch = async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);
    const personId = Number(req.params.personId);
    if (!batchId || isNaN(batchId)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    if (!personId || isNaN(personId)) return res.status(400).json({ success: false, message: "Invalid person ID" });

    const { approvedBy } = req.body;

    const batch = await BulkPassSchema.getById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Batch is not under review" });
    }

    const person = await BulkPassSchema.getPersonById(personId);
    if (!person || person.batchId !== batchId) {
      return res.status(404).json({ success: false, message: "Person not found in this batch" });
    }
    if (person.approvalStatus !== "PENDING") {
      return res.status(400).json({ success: false, message: `Person is already ${person.approvalStatus.toLowerCase()}. Use undo to reset before changing.` });
    }

    const updated = await BulkPassSchema.setPersonApprovalStatus(personId, "APPROVED", null, approvedBy || null);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[bulkPass] approvePersonInBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:batchId/persons/:personId/reject  (internal — called by approval-admin-service)
 * Reject a single person within a bulk batch.
 */
exports.rejectPersonInBatch = async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);
    const personId = Number(req.params.personId);
    if (!batchId || isNaN(batchId)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    if (!personId || isNaN(personId)) return res.status(400).json({ success: false, message: "Invalid person ID" });

    const { rejectionReason, rejectedBy } = req.body;
    if (!rejectionReason || !String(rejectionReason).trim()) {
      return res.status(400).json({ success: false, message: "rejectionReason is required" });
    }

    const batch = await BulkPassSchema.getById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Batch is not under review" });
    }

    const person = await BulkPassSchema.getPersonById(personId);
    if (!person || person.batchId !== batchId) {
      return res.status(404).json({ success: false, message: "Person not found in this batch" });
    }
    if (person.approvalStatus !== "PENDING") {
      return res.status(400).json({ success: false, message: `Person is already ${person.approvalStatus.toLowerCase()}. Use undo to reset before changing.` });
    }

    const updated = await BulkPassSchema.setPersonApprovalStatus(personId, "REJECTED", rejectionReason.trim(), rejectedBy || null);
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[bulkPass] rejectPersonInBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:batchId/persons/:personId/undo  (internal — called by approval-admin-service)
 * Undo a previous approve/reject decision — resets the person back to PENDING.
 * Only allowed while the batch is still UNDER_REVIEW (not yet finalized).
 */
exports.undoPersonInBatch = async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);
    const personId = Number(req.params.personId);
    if (!batchId || isNaN(batchId)) return res.status(400).json({ success: false, message: "Invalid batch ID" });
    if (!personId || isNaN(personId)) return res.status(400).json({ success: false, message: "Invalid person ID" });

    const batch = await BulkPassSchema.getById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Undo is only allowed while the batch is under review" });
    }

    const person = await BulkPassSchema.getPersonById(personId);
    if (!person || person.batchId !== batchId) {
      return res.status(404).json({ success: false, message: "Person not found in this batch" });
    }
    if (!person.approvalStatus || person.approvalStatus === "PENDING") {
      return res.status(400).json({ success: false, message: "Person is already pending — nothing to undo" });
    }

    // Reset to PENDING by clearing all approval fields
    const result = await pool.query(
      `UPDATE "bulk_pass_persons"
       SET "approvalStatus" = 'PENDING',
           "approvalReason" = NULL,
           "approvedBy"     = NULL,
           "approvedAt"     = NULL
       WHERE id = $1
       RETURNING *`,
      [personId]
    );

    const updated = result.rows[0];
    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[bulkPass] undoPersonInBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/finalize  (internal — called by approval-admin-service)
 * Finalize a batch after all persons have been individually approved/rejected.
 * - All persons must have been actioned (no PENDING remaining).
 * - At least one person must be APPROVED.
 * - Triggers QR/PDF generation for approved persons only.
 * - Sets batch status to COMPLETED.
 */
exports.finalizeBatch = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });

    const { qrPdfPath, finalizedBy } = req.body;

    const batch = await BulkPassSchema.getById(id);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Only UNDER_REVIEW batches can be finalized" });
    }

    // Check all persons have been actioned
    const summary = await BulkPassSchema.getPersonApprovalSummary(id);
    if (summary.pending > 0) {
      return res.status(400).json({
        success: false,
        message: `${summary.pending} person(s) still have PENDING status. All must be approved or rejected before finalizing.`,
        data: summary,
      });
    }
    if (summary.approved === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one person must be approved to finalize the batch.",
        data: summary,
      });
    }

    const updated = await BulkPassSchema.setStatus(id, "COMPLETED", { qrPdfPath: qrPdfPath || null });
    await BulkPassSchema.logTransition(
      id, "COMPLETED", finalizedBy || null,
      `Finalized: ${summary.approved} approved, ${summary.rejected} rejected out of ${summary.total} total`
    );

    sendEmail("sendBulkPassApproved", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      validityFrom: batch.validityFrom,
      validityUpto: batch.validityUpto,
      departmentName: batch.departmentName,
      approvedCount: summary.approved,
      rejectedCount: summary.rejected,
      qrLink: FRONTEND_BASE ? `${FRONTEND_BASE}/bulk_pass_approved/${encryptToken(batch.id)}` : null,
    }).catch(() => {});

    // If some persons were rejected, send a separate email listing each
    // rejected person with the officer's rejection reason.
    if (summary.rejected > 0) {
      pool.query(
        `SELECT name, aadhaar, "approvalReason" AS "rejectionReason"
         FROM "bulk_pass_persons"
         WHERE "batchId" = $1 AND "approvalStatus" = 'REJECTED' AND "vehicleNumber" IS NULL
         ORDER BY id`,
        [id]
      ).then((result) => {
        const rejectedPersons = result.rows || [];
        if (!rejectedPersons.length) return;
        return sendEmail("sendBulkPassRejectedPersons", {
          email: batch.applicantEmail,
          refNo: batch.refNo,
          companyName: batch.companyName,
          rejectedPersons,
        });
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      data: updated,
      summary,
    });
  } catch (err) {
    console.error("[bulkPass] finalizeBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/reject  (kept for backward compat — rejects ALL pending persons)
 * Called when the traffic officer wants to reject the entire batch at once.
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

    // Mark all PENDING persons as REJECTED
    await pool.query(
      `UPDATE "bulk_pass_persons"
       SET "approvalStatus" = 'REJECTED',
           "approvalReason" = $2,
           "approvedBy"     = $3,
           "approvedAt"     = NOW()
       WHERE "batchId" = $1 AND "approvalStatus" = 'PENDING'`,
      [id, rejectionReason.trim(), rejectedBy || null]
    );

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
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) return res.status(404).json({ success: false, message: "Invalid link" });
    const { batch } = resolved;
    if (isLinkExpired(batch)) return res.status(403).json({ success: false, message: "Link expired or inactive" });

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
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) return res.status(404).json({ success: false, message: "Invalid link" });
    const { batch } = resolved;
    if (isLinkExpired(batch)) return res.status(403).json({ success: false, message: "Link expired or inactive" });

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
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) return res.status(404).json({ success: false, message: "Invalid link" });

    let { batch, isParentRequest, parentRequest } = resolved;
    if (isLinkExpired(batch)) return res.status(403).json({ success: false, message: "Link expired or inactive" });

    if (!isParentRequest && !["DRAFT", "RETURNED_TO_APPLICANT"].includes(batch.status)) {
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

      // Photo: accept either a newly uploaded base64 data URL or a reused server-side path.
      const hasNewPhoto = !!row.photoDataUrl;
      const hasKeptPhoto = !hasNewPhoto && row._keepPhotoPath && typeof row._keepPhotoPath === "string" &&
        fs.existsSync(path.resolve(row._keepPhotoPath));
      if (!hasNewPhoto && !hasKeptPhoto) {
        errors.push({ index: i, message: `${rowLabel}: Photo is required` }); continue;
      }

      if (hasNewPhoto) {
        const b64Match = row.photoDataUrl.match(/^data:image\/(?:jpeg|png);base64,(.+)$/);
        if (!b64Match) { errors.push({ index: i, message: `${rowLabel}: Invalid photo format` }); continue; }

        const photoBuffer = Buffer.from(b64Match[1], "base64");
        const photoRes = await validateEmbeddedPhoto(photoBuffer);
        if (!photoRes.valid) { errors.push({ index: i, message: `${rowLabel}: ${photoRes.error}` }); continue; }
      }
    }

    // ── Aadhaar card mandatory for EVERY person ──────────────────────────────
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const uploaded = req.files && req.files[`person_${i}_aadhaarCard`] && req.files[`person_${i}_aadhaarCard`][0];
      const keptPath = !uploaded && row._keepAadhaarPath && typeof row._keepAadhaarPath === "string" &&
        fs.existsSync(path.resolve(row._keepAadhaarPath));
      if (!uploaded && !keptPath) {
        errors.push({
          index: i,
          message: `Row ${i + 1}: Aadhaar card document is required for every person`,
        });
      }
    }

    if (errors.length) {
      return res.status(400).json({ success: false, message: "Validation errors", data: { errors } });
    }

    // ── Blacklist checks ────────────────────────────────────────────────────
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

    for (let i = 0; i < vehicleMeta.length; i++) {
      const v = vehicleMeta[i];
      if (!v.regNo) continue;

      const driverAadhaarUploaded = req.files && req.files[`vehicle_${i}_driverAadhaarCard`] && req.files[`vehicle_${i}_driverAadhaarCard`][0];
      const driverAadhaarKept = !driverAadhaarUploaded &&
        v._keepVehicleDocs && v._keepVehicleDocs.driverAadhaarCard &&
        fs.existsSync(path.resolve(v._keepVehicleDocs.driverAadhaarCard));
      if (!driverAadhaarUploaded && !driverAadhaarKept) {
        return res.status(400).json({
          success: false,
          message: `Vehicle ${i + 1} (${v.regNo}): Driver Aadhaar card document is required`,
        });
      }

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

    // ── Determine Target Batch (child batch creation if parent) ──────────────
    let targetBatch = batch;
    let submissionNumber = 1;

    if (isParentRequest) {
      submissionNumber = await BulkPassSchema.getNextSubmissionNumber(parentRequest.id, 'PUBLIC_WEBSITE');
      const client = await pool.connect();
      let childRefNo;
      try {
        childRefNo = await ReferenceNumber.generateBulkPassReference(client);
      } finally {
        client.release();
      }

      const childBatchData = {
        refNo: childRefNo,
        token: buildToken(),
        tokenActive: true,
        status: 'UNDER_REVIEW',
        multipleSubmissionsEnabled: false,
        parent_request_id: parentRequest.id,
        submission_number: submissionNumber,
        request_source: 'PUBLIC_WEBSITE',
        visitorType: parentRequest.visitor_type || batch.visitorType || "BUSINESS",
        companyName: parentRequest.company_name,
        applicantEmail: parentRequest.applicant_email,
        applicantMobile: parentRequest.applicant_mobile,
        createdByUserId: parentRequest.approved_by_user_id || 1,
        departmentId: 6,
        departmentName: "General Administration",
        validityFrom: parentRequest.approved_time_from || parentRequest.validity_from || batch.validityFrom || null,
        validityUpto: parentRequest.approved_time_upto || parentRequest.validity_upto || batch.validityUpto || new Date(Date.now() + 30 * 86400000).toISOString(),
        noOfPersons: rows.length,
        noOfVehicles: vehicleMeta.length,
        purpose: parentRequest.purpose || batch.purpose || "Public Bulk Pass Submission",
        paymentMode: parentRequest.payment_mode || "CASH",
      };
      targetBatch = await BulkPassSchema.createBatch(childBatchData);
    } else if (batch.multipleSubmissionsEnabled && !batch.parent_request_id) {
      submissionNumber = await BulkPassSchema.getNextSubmissionNumber(batch.id, 'DEPARTMENT');
      const client = await pool.connect();
      let childRefNo;
      try {
        childRefNo = await ReferenceNumber.generateBulkPassReference(client);
      } finally {
        client.release();
      }

      const childBatchData = {
        refNo: childRefNo,
        token: buildToken(),
        tokenActive: true,
        status: 'UNDER_REVIEW',
        multipleSubmissionsEnabled: false,
        parent_request_id: batch.id,
        submission_number: submissionNumber,
        request_source: 'DEPARTMENT',
        visitorType: batch.visitorType || "BUSINESS",
        companyName: batch.companyName,
        applicantEmail: batch.applicantEmail,
        applicantMobile: batch.applicantMobile,
        createdByUserId: batch.createdByUserId || 1,
        departmentId: batch.departmentId || 6,
        departmentName: batch.departmentName || "General Administration",
        validityFrom: batch.validityFrom || null,
        validityUpto: batch.validityUpto || new Date(Date.now() + 30 * 86400000).toISOString(),
        noOfPersons: rows.length,
        noOfVehicles: vehicleMeta.length,
        purpose: batch.purpose || "Department Bulk Pass Submission",
        paymentMode: batch.paymentMode || "CASH",
      };
      targetBatch = await BulkPassSchema.createBatch(childBatchData);
    } else {
      await BulkPassSchema.deletePersonsByBatch(targetBatch.id);
    }

    // ── Persist persons ─────────────────────────────────────────────────────
    const uploadDir = path.join("uploads", "bulk_pass", String(targetBatch.id));
    fs.mkdirSync(uploadDir, { recursive: true });
    const personDocsDir = path.join(uploadDir, "aadhaar_cards");

    const personRows = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      let photoPath;
      if (row.photoDataUrl) {
        const b64 = row.photoDataUrl.replace(/^data:image\/(?:jpeg|png);base64,/, "");
        const photoBuffer = Buffer.from(b64, "base64");
        const compressed = await compressPhotoBuffer(photoBuffer);
        const photoFileName = `${String(row.aadhaar).replace(/\s+/g, "")}_${i}.jpg`;
        photoPath = path.join(uploadDir, photoFileName);
        fs.writeFileSync(photoPath, compressed);
      } else {
        photoPath = row._keepPhotoPath;
      }

      let aadhaarCardPath = null;
      const aadhaarUploaded = req.files && req.files[`person_${i}_aadhaarCard`] && req.files[`person_${i}_aadhaarCard`][0];
      if (aadhaarUploaded) {
        fs.mkdirSync(personDocsDir, { recursive: true });
        const destName = `${String(row.aadhaar).replace(/\s+/g, "")}_${i}_aadhaar${path.extname(aadhaarUploaded.originalname)}`;
        const destPath = path.join(personDocsDir, destName);
        try {
          fs.copyFileSync(aadhaarUploaded.path, destPath);
        } catch (copyErr) {
          if (copyErr.code === "ENOENT") {
            console.warn(`[bulkPass] Temp file missing for person_${i}_aadhaarCard: ${aadhaarUploaded.path} — skipping`);
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
              aadhaarCardPath: null,
              validationStatus: "valid",
              errorMessage: null,
            });
            continue;
          }
          throw copyErr;
        }
        try { fs.unlinkSync(aadhaarUploaded.path); } catch {}
        const compResult = await compressDocumentFile(destPath);
        aadhaarCardPath = compResult.path;
      } else if (row._keepAadhaarPath && fs.existsSync(path.resolve(row._keepAadhaarPath))) {
        aadhaarCardPath = row._keepAadhaarPath;
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

    await BulkPassSchema.insertPersons(targetBatch.id, personRows);

    // ── Persist vehicles ────────────────────────────────────────────────────
    const vehicleDir = path.join("uploads", "bulk_pass", String(targetBatch.id), "vehicles");
    if (vehicleMeta.length > 0) {
      fs.mkdirSync(vehicleDir, { recursive: true });
    }

    const vehicleRows = [];
    for (let i = 0; i < vehicleMeta.length; i++) {
      const v = vehicleMeta[i];
      if (!v.regNo) continue;

      const docFields = ["rc", "insurance", "fitness", "permit", "roadTax", "emission", "driverAadhaarCard", "driverLicense"];
      const docPaths = {};
      for (const field of docFields) {
        const fileKey = `vehicle_${i}_${field}`;
        const uploaded = req.files && req.files[fileKey] && req.files[fileKey][0];
        if (uploaded) {
          const destName = `${v.regNo.replace(/\s+/g, "_")}_${field}${path.extname(uploaded.originalname)}`;
          const destPath = path.join(vehicleDir, destName);
          try {
            fs.copyFileSync(uploaded.path, destPath);
          } catch (copyErr) {
            if (copyErr.code === "ENOENT") {
              console.warn(`[bulkPass] Temp file missing for vehicle_${i}_${field}: ${uploaded.path} — skipping`);
              continue;
            }
            throw copyErr;
          }
          try { fs.unlinkSync(uploaded.path); } catch {}
          const compResult = await compressDocumentFile(destPath);
          docPaths[field] = compResult.path;
        } else if (
          v._keepVehicleDocs &&
          v._keepVehicleDocs[field] &&
          fs.existsSync(path.resolve(v._keepVehicleDocs[field]))
        ) {
          docPaths[field] = v._keepVehicleDocs[field];
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
        driverLicenseNumber: v.driverLicenseNumber ? String(v.driverLicenseNumber).trim() : null,
        driverLicensePath: docPaths.driverLicense || null,
        vehicleDocs: Object.keys(docPaths).length > 0 ? docPaths : null,
        validationStatus: "valid",
        errorMessage: null,
      });
    }

    if (vehicleRows.length > 0) {
      await BulkPassSchema.insertPersons(targetBatch.id, vehicleRows);
    }

    // Applicant submission goes DIRECTLY to Traffic (UNDER_REVIEW).
    // If it's a single batch, deactivate single token. If it's parent request/batch, keep parent token active.
    const isChildSubmission = isParentRequest || (batch.multipleSubmissionsEnabled && !batch.parent_request_id);

    await BulkPassSchema.setStatus(targetBatch.id, "UNDER_REVIEW", {
      tokenActive: isChildSubmission ? true : false,
      submittedAt: new Date().toISOString(),
    });
    await BulkPassSchema.logTransition(targetBatch.id, "UNDER_REVIEW", null, "Applicant submitted — forwarded directly to Traffic Officer");

    sendEmail("sendBulkPassSubmitted", {
      email: targetBatch.applicantEmail,
      refNo: targetBatch.refNo,
      companyName: targetBatch.companyName,
      personsCount: personRows.length,
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Batch submitted successfully",
      data: {
        refNo: targetBatch.refNo,
        personsSubmitted: personRows.length,
        vehiclesSubmitted: vehicleRows.length,
        status: "UNDER_REVIEW",
        submissionNumber: submissionNumber,
      },
    });
  } catch (err) {
    return handleBulkPassError(res, err, "Failed to submit bulk pass rows");
  }
};

/**
 * GET /api/bulk-pass/batches/:parentId/submissions  (protected — Dept User)
 * Get child submissions for a parent batch (Multiple Pass Submissions Feature)
 * Requirements: 3.1-3.5, 8.1-8.6, 13.4
 */
exports.getChildSubmissions = async (req, res) => {
  try {
    const parentId = Number(req.params.parentId);
    if (!parentId || isNaN(parentId)) {
      return res.status(400).json({ success: false, message: "Invalid parent batch ID" });
    }

    // Get the parent batch
    const parentBatch = await BulkPassSchema.getById(parentId);
    if (!parentBatch) {
      return res.status(404).json({ success: false, message: "Parent batch not found" });
    }

    // Authorization check
    const role = (req.user?.role || "").toLowerCase();
    const deptName = (req.user?.departmentName || "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrator" || role === "super admin" || role === "superadmin";
    const isTrafficApprover = (role === "approval" && deptName.includes("traffic")) || role.includes("traffic");

    if (!isAdmin && !isTrafficApprover && parentBatch.createdByUserId !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Check if this is actually a parent batch
    if (!parentBatch.multipleSubmissionsEnabled) {
      return res.status(400).json({ 
        success: false, 
        message: "This batch does not have multiple submissions enabled" 
      });
    }

    // Get child submissions using the schema method
    // For department-created parent batches, source is 'DEPARTMENT'
    const childBatches = await BulkPassSchema.getChildBatches(parentId, 'DEPARTMENT');

    return res.status(200).json({
      success: true,
      parentBatch: {
        id: parentBatch.id,
        refNo: parentBatch.refNo,
        companyName: parentBatch.companyName,
        multipleSubmissionsEnabled: parentBatch.multipleSubmissionsEnabled,
        validityFrom: parentBatch.validityFrom,
        validityUpto: parentBatch.validityUpto,
        status: parentBatch.status,
      },
      submissions: childBatches.map(batch => ({
        id: batch.id,
        submissionNumber: batch.submission_number,
        refNo: batch.refNo,
        personsCount: batch.noOfPersons || 0,
        vehiclesCount: batch.noOfVehicles || 0,
        status: batch.status,
        createdAt: batch.createdAt,
      })),
      totalSubmissions: childBatches.length,
    });
  } catch (err) {
    console.error("[bulkPass] getChildSubmissions error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
