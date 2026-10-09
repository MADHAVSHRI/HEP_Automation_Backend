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
const { BULK_VISITOR_TYPES, BULK_PASS_LIMITS, isStudentVisitorType } = require("../constants/constants");
const {
  getValidityState,
  getLinkState,
  getBlockedMessage,
  normalizeValidityUpto,
  resolveBatchValidity,
  getBatchValidityBounds,
  combineValidity,
  formatValidityDateTime,
  EXPIRY_WARNING_DAYS,
} = require("../utils/bulkPassValidity");

// Statuses in which the applicant may still submit or correct a batch.
// REJECTED is included because a rejection now reopens the link for correction
// rather than ending the road.
const CORRECTABLE_STATUSES = ["DRAFT", "RETURNED_TO_APPLICANT", "REJECTED"];
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
// Public approved-pass page (/bulk_pass_approved/:id). The page expects the
// AES-encrypted batch id, and the frontend has no key, so the server must hand
// the encrypted id over — never let a client build this URL from the raw id.
const encryptBatchId = (id) => encryptToken(String(id));
const buildPassViewLink = (id) => `${FRONTEND_BASE}/bulk_pass_approved/${encryptBatchId(id)}`;

// ── Encrypted-link resolution ───────────────────────────────────────────────
// All public bulk-pass links carry an AES-256-GCM encrypted token/id in the URL
// (mirrors the vendor-pass scheme). These helpers transparently decrypt the
// incoming value and fall back to treating it as raw (so older plain links and
// internal numeric ids keep working).

const getResolvedToken = (tokenOrHash) => {
  if (!tokenOrHash) return "";
  const decrypted = decryptToken(tokenOrHash);
  if (decrypted) return decrypted;
  // Links issued by the public-request flow before it moved to this scheme
  // were encrypted with tokenUtils (AES-CBC). Keep them working.
  try {
    const legacy = require("../utils/tokenUtils").decryptToken(tokenOrHash);
    if (legacy) return legacy;
  } catch {
    // not a legacy link either — fall through to treating it as raw
  }
  return tokenOrHash;
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
// A link "valid upto 30 Sep" must work all of 30 Sep, so a bare-midnight
// expiry is stretched to the end of that day — the same rule the validity
// window uses. `tokenActiveRaw` (set by getByToken) is the stored flag, before
// the time-based override that would otherwise hide the last day.
const isLinkExpired = (batch) => {
  const stored = batch.tokenActiveRaw !== undefined ? batch.tokenActiveRaw : batch.tokenActive;
  if (!stored) return true;
  if (!batch.tokenExpiresAt) return false;
  const upto = normalizeValidityUpto(batch.tokenExpiresAt);
  return !!upto && upto.getTime() < Date.now();
};

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
    const uptoEnd = normalizeValidityUpto(parentRequest.approved_time_upto);
    const expiredByTime = !!uptoEnd && uptoEnd.getTime() < Date.now();

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

// A cumulative limit is optional; anything unset stays null ("no limit").
const toLimit = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

/**
 * Applicant-facing explanation for why the Bulk Pass will not take another
 * batch right now. Returns null while submissions are open.
 */
const describeBlock = (blockReason, validity, bulkPassView, remaining) => {
  if (!blockReason) return null;
  switch (blockReason) {
    case "NOT_APPROVED":
      return "This bulk pass request has not been approved yet.";
    case "LINK_INACTIVE":
      return "This bulk pass link has been deactivated. Please contact the issuing department.";
    case "SUBMISSION_LIMIT_REACHED":
      return `This bulk pass has reached its limit of ${bulkPassView?.maxSubmissions} batch submission(s). Your previous submissions remain available.`;
    case "PERSON_LIMIT_REACHED":
      return `This bulk pass has reached its limit of ${bulkPassView?.maxTotalPersons} person(s) in total (${remaining?.personsApproved ?? 0} approved, ${remaining?.personsPending ?? 0} awaiting review). Rejected persons do not count and may be sent again. Your previous submissions remain available.`;
    case "VEHICLE_LIMIT_REACHED":
      return `This bulk pass has reached its limit of ${bulkPassView?.maxTotalVehicles} vehicle(s) in total. Persons can still be submitted without vehicles.`;
    case "NOT_SUBMITTABLE":
      return "This batch is no longer open for changes.";
    default:
      return getBlockedMessage(validity);
  }
};

/**
 * How much of a Bulk Pass's cumulative budget is left.
 * Returns null fields where no limit is configured.
 */
const buildRemaining = (bulkPassView, summary) => {
  if (!bulkPassView) return null;
  const used = summary || {};
  // The budget is charged for what is approved or still awaiting a decision.
  // Rejected people, and rejected batches, hand their place back — older
  // summaries without the counted* fields fall back to the raw totals.
  const submissionsUsed = used.countedSubmissions ?? used.totalSubmissions ?? 0;
  const personsUsed = used.countedPersons ?? used.totalPersons ?? 0;
  const vehiclesUsed = used.countedVehicles ?? used.totalVehicles ?? 0;
  return {
    submissionsUsed,
    personsUsed,
    vehiclesUsed,
    personsApproved: used.approvedPersons ?? 0,
    personsPending: used.pendingPersons ?? 0,
    personsRejected: used.rejectedPersons ?? 0,
    personsSubmitted: used.totalPersons ?? 0,
    vehiclesApproved: used.approvedVehicles ?? 0,
    vehiclesPending: used.pendingVehicles ?? 0,
    vehiclesRejected: used.rejectedVehicles ?? 0,
    vehiclesSubmitted: used.totalVehicles ?? 0,
    // What one batch may carry, whatever the pass allows in total.
    perBatchMaxPersons: BULK_PASS_LIMITS.MAX_PERSONS_PER_BATCH,
    perBatchMaxVehicles: BULK_PASS_LIMITS.MAX_VEHICLES_PER_BATCH,
    submissionsRemaining:
      bulkPassView.maxSubmissions == null
        ? null
        : Math.max(0, bulkPassView.maxSubmissions - submissionsUsed),
    personsRemaining:
      bulkPassView.maxTotalPersons == null
        ? null
        : Math.max(0, bulkPassView.maxTotalPersons - personsUsed),
    vehiclesRemaining:
      bulkPassView.maxTotalVehicles == null
        ? null
        : Math.max(0, bulkPassView.maxTotalVehicles - vehiclesUsed),
  };
};

/**
 * The cumulative budget of a Bulk Pass, whichever table it lives in.
 *
 * "Max No. of Persons" / "Max No. of Vehicles" on the pass are totals across
 * every batch. Passes issued under the older model may carry a separate,
 * larger maxTotalPersons; that is honoured so nothing already issued shrinks.
 * A total of 0 persons cannot be meant literally (every batch needs people) and
 * falls back to the default; 0 vehicles means exactly that.
 */
const budgetOf = (parent) => {
  const totalPersons = Number(parent?.noOfPersons ?? parent?.no_of_persons);
  const totalVehicles = Number(parent?.noOfVehicles ?? parent?.no_of_vehicles);
  const legacyPersons = toLimit(parent?.maxTotalPersons ?? parent?.max_total_persons);
  const passPersons = totalPersons > 0 ? totalPersons : BULK_PASS_LIMITS.DEFAULT_MAX_PERSONS;
  return {
    // Optional cap on the number of batches; kept for passes that set one.
    maxSubmissions: toLimit(parent?.maxSubmissions ?? parent?.max_submissions),
    maxTotalPersons: legacyPersons != null ? Math.max(legacyPersons, passPersons) : passPersons,
    maxTotalVehicles: Number.isFinite(totalVehicles) && totalVehicles >= 0
      ? totalVehicles
      : BULK_PASS_LIMITS.DEFAULT_MAX_VEHICLES,
  };
};

/**
 * What one submission may carry: the system's per-batch ceiling, or the pass
 * total when that is smaller (a 10-person pass never needs a 30-row form).
 */
const perBatchCeilings = (source) => {
  const budget = budgetOf(source);
  return {
    maxPersons: Math.min(budget.maxTotalPersons, BULK_PASS_LIMITS.MAX_PERSONS_PER_BATCH),
    maxVehicles: Math.min(budget.maxTotalVehicles, BULK_PASS_LIMITS.MAX_VEHICLES_PER_BATCH),
  };
};

/**
 * Has the issuing department switched this link off? Time-based expiry is
 * reported through the validity window instead, so an expired pass can still
 * serve its history.
 */
const isRevoked = (parent, source, validity) => {
  if (!parent) return false;
  if (source === "PUBLIC_WEBSITE") {
    return !parent.token_active && validity?.state !== "EXPIRED";
  }
  if (parent.tokenActiveRaw !== undefined) return parent.tokenActiveRaw === false;
  return parent.tokenActive === false;
};

/**
 * Everything the portal needs to know about one Bulk Pass in a single object:
 * validity, budget, history and whether another batch may be sent right now.
 *
 * Shared by validate-token, the history refresh and the post-submit response
 * so the applicant never sees two different answers to "can I submit?".
 *
 * @param {Object} parent        parent batch row or parent request row
 * @param {'DEPARTMENT'|'PUBLIC_WEBSITE'} source
 * @param {{ identifier?, isApproved?, excludeBatchId? }} options
 *   excludeBatchId — a batch being revised; its rows are about to be replaced
 *   so they are left out of the remaining-budget arithmetic.
 */
async function resolveBulkPassGate(parent, source, { identifier, isApproved = true, excludeBatchId = null } = {}) {
  // The link is open from creation until the pass expires — a visit window
  // that starts later does not keep applicants from sending batches early.
  const validity = getLinkState(parent);
  const revoked = isRevoked(parent, source, validity);

  const [submissionHistory, submissionSummary, nextSubmissionNumber, budgetSummary] = await Promise.all([
    BulkPassSchema.getChildBatches(parent.id, source),
    BulkPassSchema.getSubmissionSummary(parent.id, source),
    BulkPassSchema.getNextSubmissionNumber(parent.id, source),
    excludeBatchId
      ? BulkPassSchema.getSubmissionSummary(parent.id, source, { excludeBatchId })
      : null,
  ]);

  const bulkPassView = buildBulkPassView(parent, {
    source,
    validity,
    identifier: identifier || parent.refNo || parent.tracking_number,
  });
  const remaining = buildRemaining(bulkPassView, budgetSummary || submissionSummary);

  let blockReason = null;
  if (!isApproved) blockReason = "NOT_APPROVED";
  else if (revoked) blockReason = "LINK_INACTIVE";
  else if (!validity.canSubmit) blockReason = validity.state;
  else if (remaining.submissionsRemaining === 0) blockReason = "SUBMISSION_LIMIT_REACHED";
  else if (remaining.personsRemaining === 0) blockReason = "PERSON_LIMIT_REACHED";

  return {
    validity,
    revoked,
    bulkPassView,
    remaining,
    blockReason,
    canSubmit: !blockReason,
    message: describeBlock(blockReason, validity, bulkPassView, remaining),
    submissionHistory,
    submissionSummary,
    nextSubmissionNumber,
  };
}

/**
 * Check a batch of `personCount` people against the Bulk Pass budget.
 *
 * Returns null when the batch fits, otherwise `{ status, body }` ready to send.
 * A revision passes its own batch id so the rows it is replacing are not
 * counted against it.
 */
async function checkBulkPassBudget(parent, source, personCount, { excludeBatchId = null, vehicleCount = 0 } = {}) {
  const { maxSubmissions, maxTotalPersons, maxTotalVehicles } = budgetOf(parent);

  const used = (await BulkPassSchema.getSubmissionSummary(parent.id, source, { excludeBatchId })) || {};
  const submissionsUsed = used.countedSubmissions ?? used.totalSubmissions ?? 0;
  const personsUsed = used.countedPersons ?? used.totalPersons ?? 0;
  const vehiclesUsed = used.countedVehicles ?? used.totalVehicles ?? 0;
  const limits = { maxSubmissions, maxTotalPersons, maxTotalVehicles };

  if (maxSubmissions != null && submissionsUsed >= maxSubmissions) {
    return {
      status: 403,
      body: {
        success: false,
        message: `This bulk pass has reached its limit of ${maxSubmissions} batch submission(s). Please contact the issuing department.`,
        data: { blockReason: "SUBMISSION_LIMIT_REACHED", used, limits },
      },
    };
  }

  if (maxTotalPersons != null) {
    const personsRemaining = Math.max(0, maxTotalPersons - personsUsed);
    if (personsRemaining === 0) {
      return {
        status: 403,
        body: {
          success: false,
          message: `This bulk pass has reached its limit of ${maxTotalPersons} person(s) in total. Rejected persons do not count and may be sent again; please contact the issuing department for a higher limit.`,
          data: { blockReason: "PERSON_LIMIT_REACHED", used, limits, remaining: 0 },
        },
      };
    }
    if (personCount > personsRemaining) {
      // Not a closed door: the applicant only has to trim the batch.
      return {
        status: 400,
        body: {
          success: false,
          message: `This bulk pass allows ${maxTotalPersons} person(s) in total and ${personsUsed} are already approved or awaiting review. You can add ${personsRemaining} more in this batch — please remove ${personCount - personsRemaining}.`,
          data: { blockReason: "PERSON_LIMIT_EXCEEDS_REMAINING", used, limits, remaining: personsRemaining },
        },
      };
    }
  }

  // Vehicles are optional, so running out of them never closes the pass; it
  // only limits how many this batch may carry.
  if (maxTotalVehicles != null && vehicleCount > 0) {
    const vehiclesRemaining = Math.max(0, maxTotalVehicles - vehiclesUsed);
    if (vehicleCount > vehiclesRemaining) {
      return {
        status: 400,
        body: {
          success: false,
          message:
            vehiclesRemaining === 0
              ? `This bulk pass allows ${maxTotalVehicles} vehicle(s) in total and all of them are already approved or awaiting review. Please remove the vehicle entries; persons can still be submitted.`
              : `This bulk pass allows ${maxTotalVehicles} vehicle(s) in total and ${vehiclesUsed} are already approved or awaiting review. You can add ${vehiclesRemaining} more in this batch — please remove ${vehicleCount - vehiclesRemaining}.`,
          data: { blockReason: "VEHICLE_LIMIT_EXCEEDS_REMAINING", used, limits, remaining: vehiclesRemaining },
        },
      };
    }
  }

  return null;
}

/**
 * Serialise submissions against one Bulk Pass.
 *
 * The budget check reads what is already stored and the batch is written
 * afterwards, so two applicants (or one applicant in two tabs) racing each
 * other could both pass the check. A session-level advisory lock keyed on the
 * Bulk Pass keeps them in single file. Fails open if a connection cannot be
 * obtained, so a locking problem never blocks the module outright.
 */
async function withBulkPassLock(parent, source, fn) {
  const key = `bulk_pass:${source}:${parent?.id}`;
  let client = null;
  try {
    client = await pool.connect();
    if (!client || typeof client.query !== "function") client = null;
    else await client.query("SELECT pg_advisory_lock(hashtext($1))", [key]);
  } catch (lockErr) {
    console.warn("[bulkPass] advisory lock unavailable, continuing without it:", lockErr.message);
    if (client && typeof client.release === "function") { try { client.release(); } catch {} }
    client = null;
  }
  try {
    return await fn();
  } finally {
    if (client) {
      try { await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]); } catch {}
      try { client.release(); } catch {}
    }
  }
}

/**
 * Flatten a Bulk Pass — whether it is stored as a department batch or as a
 * public parent request — into the single shape the applicant portal renders.
 *
 * `maxPersons` / `maxVehicles` are deliberately named: on a multi-submission
 * Bulk Pass these are the ceiling for each individual batch, not a total across
 * the whole pass.
 */
const buildBulkPassView = (source, { source: requestSource, validity, identifier } = {}) => {
  if (!source) return null;
  return {
    id: source.id,
    identifier: identifier || source.refNo || source.tracking_number || null,
    refNo: source.refNo || null,
    trackingNumber: source.tracking_number || null,
    companyName: source.companyName || source.company_name || null,
    departmentName: source.departmentName || "General Administration",
    visitorType: source.visitorType || source.visitor_type || null,
    applicantEmail: source.applicantEmail || source.applicant_email || null,
    applicantMobile: source.applicantMobile || source.applicant_mobile || null,
    // Pass-level totals across every batch.
    maxPersons: Number(source.noOfPersons ?? source.no_of_persons ?? 0),
    maxVehicles: Number(source.noOfVehicles ?? source.no_of_vehicles ?? 0),
    maxTotalPersons: budgetOf(source).maxTotalPersons,
    maxTotalVehicles: budgetOf(source).maxTotalVehicles,
    // Optional cap on the number of batches. null = no limit.
    maxSubmissions: toLimit(source.maxSubmissions ?? source.max_submissions),
    // What any one batch may carry.
    perBatchMaxPersons: BULK_PASS_LIMITS.MAX_PERSONS_PER_BATCH,
    perBatchMaxVehicles: BULK_PASS_LIMITS.MAX_VEHICLES_PER_BATCH,
    paymentMode: source.paymentMode || source.payment_mode || null,
    purpose: source.purpose || null,
    refDocNo: source.refDocNo || source.ref_doc_no || null,
    workOrderRequired: source.workOrderRequired ?? source.work_order_required ?? false,
    remarks: source.remarks || null,
    status: source.status || null,
    requestSource: requestSource || source.request_source || "DEPARTMENT",
    validityFrom: validity?.validityFrom ?? null,
    validityUpto: validity?.validityUpto ?? null,
  };
};


/**
 * Everything the applicant needs to correct a batch that came back to them.
 *
 * A correction must never mean retyping: the rows come back populated, the
 * server-side photos and documents are reused unless replaced, and each row
 * carries the officer's verdict so the applicant can see exactly which people
 * are the problem instead of guessing from one batch-level sentence.
 *
 * @param {number} batchId
 * @param {string|null} batchReason - the batch-level return/rejection reason
 * @returns {{ previousPersons, previousVehicles, issues }}
 */
async function buildCorrectionData(batchId, batchReason = null) {
  const rows = (await BulkPassSchema.getPersonsByBatch(batchId)) || [];

  // Stored as YYYY-MM-DD; the form speaks DD/MM/YYYY.
  const toFormDob = (v) => {
    if (!v) return "";
    const parts = String(v).split("T")[0].split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : v;
  };

  const isVehicle = (r) => !!(r.vehicleNumber && String(r.vehicleNumber).trim() !== "");
  const personRows = rows.filter((r) => !isVehicle(r));
  const vehicleRows = rows.filter(isVehicle);

  const previousPersons = personRows.map((p) => ({
    id: p.id,
    name: p.name || "",
    aadhaar: p.aadhaar || "",
    dob: toFormDob(p.dob),
    mobile: p.mobile || "",
    inCharge: p.inCharge === true,
    photoPath: p.photoPath || null,             // reused unless replaced
    aadhaarCardPath: p.aadhaarCardPath || null, // reused unless replaced
    approvalStatus: p.approvalStatus || "PENDING",
    approvalReason: p.approvalReason || null,
  }));

  const previousVehicles = vehicleRows.map((v) => ({
    id: v.id,
    regNo: v.vehicleNumber || "",
    vehicleType: v.vehicleType || "",
    driverName: v.name || "",
    driverAadhaar: v.aadhaar || "",
    driverMobile: v.mobile || "",
    driverDob: toFormDob(v.dob),
    driverLicenseNumber: v.driverLicenseNumber || "",
    vehicleDocs: v.vehicleDocs || {},
    approvalStatus: v.approvalStatus || "PENDING",
    approvalReason: v.approvalReason || null,
  }));

  // A concise account of what has to change, so the portal and the email can
  // say the same thing.
  const flagged = [...previousPersons, ...previousVehicles].filter(
    (r) => r.approvalStatus === "REJECTED"
  );

  const issues = {
    batchReason: batchReason || null,
    rejectedPersons: previousPersons.filter((p) => p.approvalStatus === "REJECTED").length,
    rejectedVehicles: previousVehicles.filter((v) => v.approvalStatus === "REJECTED").length,
    approvedPersons: previousPersons.filter((p) => p.approvalStatus === "APPROVED").length,
    // One line per flagged row, already phrased for display.
    items: flagged.map((r) => ({
      label: r.name || r.regNo || "Unnamed entry",
      identifier: r.regNo || (r.aadhaar ? `XXXX XXXX ${String(r.aadhaar).slice(-4)}` : null),
      kind: r.regNo ? "VEHICLE" : "PERSON",
      reason: r.approvalReason || batchReason || "Marked for correction",
    })),
  };

  return { previousPersons, previousVehicles, issues };
}


/**
 * Re-check every person and vehicle in a batch against the blacklist and attach
 * the verdict to each row.
 *
 * The blacklist is enforced at submission time, but the reviewing officer never
 * saw the result — so a person blacklisted *after* they were submitted would be
 * approved unknowingly. Checking at read time means the officer always sees the
 * current position.
 */
async function annotateBlacklist(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const norm = (v) => String(v || "").replace(/[\s-]/g, "").toUpperCase();

  const aadhaars = [...new Set(rows.map((r) => norm(r.aadhaar)).filter(Boolean))];
  const vehicleNos = [...new Set(rows.map((r) => norm(r.vehicleNumber)).filter(Boolean))];

  const [personHits, vehicleHits] = await Promise.all([
    aadhaars.length
      ? pool.query(
          `SELECT identifier, reason, entity_type, status FROM blacklist_entries
           WHERE entity_type IN ('PERSON', 'DRIVER')
             AND identifier = ANY($1)
             AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')`,
          [aadhaars]
        )
      : { rows: [] },
    vehicleNos.length
      ? pool.query(
          `SELECT identifier, reason, entity_type, status FROM blacklist_entries
           WHERE entity_type = 'VEHICLE'
             AND REPLACE(REPLACE(UPPER(identifier), ' ', ''), '-', '') = ANY($1)
             AND status IN ('BLACKLISTED', 'UNBLACKLIST_REQUESTED', 'PENDING_BLACKLIST')`,
          [vehicleNos]
        )
      : { rows: [] },
  ]);

  const personMap = new Map(personHits.rows.map((r) => [norm(r.identifier), r]));
  const vehicleMap = new Map(vehicleHits.rows.map((r) => [norm(r.identifier), r]));

  return rows.map((r) => {
    const hit = personMap.get(norm(r.aadhaar)) || vehicleMap.get(norm(r.vehicleNumber));
    return hit
      ? { ...r, blacklist: { status: hit.status, reason: hit.reason, entityType: hit.entity_type } }
      : r;
  });
}

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

  const isReusableLink = multipleSubmissionsEnabled === true || multipleSubmissionsEnabled === "true";
  const isBlankValue = (v) => v === undefined || v === null || v === "";
  const persons = isBlankValue(noOfPersons) ? BULK_PASS_LIMITS.DEFAULT_MAX_PERSONS : Number(noOfPersons);
  const vehicles = isBlankValue(noOfVehicles) ? BULK_PASS_LIMITS.DEFAULT_MAX_VEHICLES : Number(noOfVehicles);
  const totalsCheck = validatePassTotals(persons, vehicles, isReusableLink);
  if (!totalsCheck.ok) return totalsCheck;

  // A window is a date + time in IST; a date sent without its time gets the
  // 06:00 / 18:00 default.
  const uptoEnd = combineValidity(validityUpto, body.validityUptoTime, { upto: true });
  if (!uptoEnd) {
    return { ok: false, status: 400, message: "Invalid validity upto date or time" };
  }
  if (uptoEnd.getTime() <= Date.now()) {
    return { ok: false, status: 400, message: "Validity upto must be in the future" };
  }

  let fromStart = null;
  if (validityFrom) {
    fromStart = combineValidity(validityFrom, body.validityFromTime);
    if (!fromStart) {
      return { ok: false, status: 400, message: "Invalid validity from date or time" };
    }
    if (fromStart.getTime() >= uptoEnd.getTime()) {
      return { ok: false, status: 400, message: "Validity from must be before validity upto" };
    }
  }

  // Validate multipleSubmissionsEnabled if provided
  if (multipleSubmissionsEnabled !== undefined && multipleSubmissionsEnabled !== null) {
    if (typeof multipleSubmissionsEnabled !== 'boolean' && multipleSubmissionsEnabled !== 'true' && multipleSubmissionsEnabled !== 'false') {
      return { ok: false, status: 400, message: "Invalid multipleSubmissionsEnabled value" };
    }
  }

  if (isReusableLink) {
    const limitsCheck = validateCumulativeLimits(body.maxSubmissions);
    if (!limitsCheck.ok) return limitsCheck;
  }

  return { ok: true, validityFrom: fromStart, validityUpto: uptoEnd };
}

/**
 * The pass-level totals. Any size on a reusable pass (it is used up over
 * batches of at most 30); a single-submission pass carries exactly one batch,
 * so its totals cannot exceed what one batch may hold.
 */
function validatePassTotals(persons, vehicles, isReusable) {
  const perBatchP = BULK_PASS_LIMITS.MAX_PERSONS_PER_BATCH;
  const perBatchV = BULK_PASS_LIMITS.MAX_VEHICLES_PER_BATCH;

  if (!Number.isInteger(persons) || persons < 1) {
    return { ok: false, status: 400, message: "Max No. of Persons must be a whole number of at least 1" };
  }
  if (!Number.isInteger(vehicles) || vehicles < 0) {
    return { ok: false, status: 400, message: "Max No. of Vehicles must be a whole number of 0 or more" };
  }

  if (isReusable) {
    if (persons > BULK_PASS_LIMITS.MAX_TOTAL_PERSONS) {
      return { ok: false, status: 400, message: `Max No. of Persons cannot exceed ${BULK_PASS_LIMITS.MAX_TOTAL_PERSONS}` };
    }
    if (vehicles > BULK_PASS_LIMITS.MAX_TOTAL_VEHICLES) {
      return { ok: false, status: 400, message: `Max No. of Vehicles cannot exceed ${BULK_PASS_LIMITS.MAX_TOTAL_VEHICLES}` };
    }
    return { ok: true };
  }

  if (persons > perBatchP) {
    return {
      ok: false,
      status: 400,
      message: `A single-submission bulk pass carries one batch of at most ${perBatchP} persons. Enable multiple submissions to allow more.`,
    };
  }
  if (vehicles > perBatchV) {
    return {
      ok: false,
      status: 400,
      message: `A single-submission bulk pass carries one batch of at most ${perBatchV} vehicles. Enable multiple submissions to allow more.`,
    };
  }
  return { ok: true };
}

/**
 * Optional cap on the number of batches a reusable pass accepts. Blank means
 * "no limit"; anything else must be a whole number of at least one.
 */
function validateCumulativeLimits(maxSubmissions) {
  const isBlank = (v) => v === undefined || v === null || v === "";
  if (!isBlank(maxSubmissions)) {
    const n = Number(maxSubmissions);
    if (!Number.isInteger(n) || n < 1) {
      return { ok: false, status: 400, message: "Max batches must be a whole number of at least 1, or blank for no limit" };
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
      remarks,
      multipleSubmissionsEnabled,
      maxSubmissions,
      maxTotalPersons,
    } = req.body;
    const validityFrom = validation.validityFrom ? validation.validityFrom.toISOString() : null;
    const validityUpto = validation.validityUpto.toISOString();

    // The create forms submit "purposeOfVisit"; accept it as a fallback for "purpose".
    const resolvedPurpose = purpose || purposeOfVisit || "";

    // Max persons/vehicles fall back to the Bulk Pass defaults when the caller
    // omits them entirely. An explicit 0 is respected.
    const isBlank = (v) => v === undefined || v === null || v === "";
    const maxPersons = isBlank(noOfPersons)
      ? BULK_PASS_LIMITS.DEFAULT_MAX_PERSONS
      : Number(noOfPersons) || 0;
    const maxVehicles = isBlank(noOfVehicles)
      ? BULK_PASS_LIMITS.DEFAULT_MAX_VEHICLES
      : Number(noOfVehicles) || 0;

    const isReusable = multipleSubmissionsEnabled === true || multipleSubmissionsEnabled === "true";

    // Work order file (reuses uploadMiddleware.js for the single workOrder field)
    const fileEntry = Array.isArray(req.files?.workOrder) && req.files.workOrder[0];
    const workOrderFilePath = fileEntry ? fileEntry.path : null;
    const workOrderFileName = fileEntry ? (fileEntry.originalname || fileEntry.filename || null) : null;

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
        workOrderFilePath,
        workOrderFileName,
        noOfPersons: maxPersons,
        noOfVehicles: maxVehicles,
        paymentMode: paymentMode || "CASH",
        purpose: resolvedPurpose,
        validityFrom: validityFrom || null,
        validityUpto,
        remarks: remarks || null,
        status: "DRAFT",
        tokenExpiresAt: validityUpto,
        multipleSubmissionsEnabled: isReusable,
        // An optional cap on batches only means anything on a reusable link.
        maxSubmissions: isReusable ? toLimit(maxSubmissions) : null,
        // The pass total is the person budget; the legacy column mirrors it so
        // older readers agree with the new ones.
        maxTotalPersons: isReusable ? maxPersons : null,
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
      multipleSubmissionsEnabled: batch.multipleSubmissionsEnabled,
      maxSubmissions: batch.maxSubmissions ?? null,
      maxTotalPersons: batch.maxTotalPersons ?? null,
      maxTotalVehicles: batch.noOfVehicles ?? null,
      perBatchMaxPersons: BULK_PASS_LIMITS.MAX_PERSONS_PER_BATCH,
      perBatchMaxVehicles: BULK_PASS_LIMITS.MAX_VEHICLES_PER_BATCH,
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
    console.error("[bulkPass] createIntake stack:", err.stack);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
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
      multipleSubmissionsEnabled: batch.multipleSubmissionsEnabled,
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

    // A reusable Bulk Pass is a container, not a batch. Its own `status` stays
    // DRAFT for life, which reads as "Sent to User" long after batches have
    // been approved through it — so derive a container lifecycle from the
    // validity window instead of trusting the batch status column.
    const decorated = rows.map((row) => {
      if (!row.multipleSubmissionsEnabled || row.parentRequestId) return row;
      const validity = getValidityState(row);
      return {
        ...row,
        isBulkPassContainer: true,
        bulkPassStatus:
          row.tokenActive === false && validity.state === "ACTIVE" ? "REVOKED" : validity.state,
        validityState: validity.state,
        expiringSoon: validity.expiringSoon,
        daysRemaining: validity.daysRemaining,
      };
    });

    return res.status(200).json({ success: true, data: decorated });
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

    const [rawPersons, uploads, statusLog, approvalSummary] = await Promise.all([
      BulkPassSchema.getPersonsByBatch(id),
      BulkPassSchema.getUploadsByBatch(id),
      BulkPassSchema.getStatusLog(id),
      BulkPassSchema.getPersonApprovalSummary(id),
    ]);

    // Show the reviewing officer the current blacklist position, not the one
    // that happened to hold when the applicant submitted.
    const persons = await annotateBlacklist(rawPersons);

    // Per-person decisions change while the batch is under review; a cached
    // copy (304) shown after navigating back hides the officer's Undo buttons.
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return res.status(200).json({
      success: true,
      data: {
        // The link is encrypted server-side, so the console cannot derive it —
        // hand it over so officers can copy, read out or show it as a QR.
        batch: {
          ...batch,
          uploadLink: batch.token ? buildUploadLink(batch.token) : null,
          // Encrypted id for the public approved-pass page; the console opens
          // `/bulk_pass_approved/${encryptedId}` with it (see traffic detail pages).
          encryptedId: encryptBatchId(batch.id),
          passViewLink: batch.status === "COMPLETED" ? buildPassViewLink(batch.id) : null,
        },
        persons,
        uploads,
        statusLog,
        approvalSummary,
      },
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

    // A reusable Bulk Pass container stays in DRAFT for its whole life (its
    // batches carry the workflow), so it remains editable throughout.
    if (!batch.multipleSubmissionsEnabled && !["DRAFT", "REJECTED", "RETURNED_TO_APPLICANT"].includes(batch.status)) {
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
    // Older clients sent the person total as maxTotalPersons; it is the same
    // number as noOfPersons now.
    if (req.body.noOfPersons === undefined && req.body.maxTotalPersons !== undefined && req.body.maxTotalPersons !== "") {
      req.body.noOfPersons = req.body.maxTotalPersons;
    }
    if (req.body.noOfPersons !== undefined || req.body.noOfVehicles !== undefined) {
      const persons = req.body.noOfPersons !== undefined ? Number(req.body.noOfPersons) : Number(batch.noOfPersons) || BULK_PASS_LIMITS.DEFAULT_MAX_PERSONS;
      const vehicles = req.body.noOfVehicles !== undefined ? Number(req.body.noOfVehicles) : Number(batch.noOfVehicles) || 0;
      const totalsCheck = validatePassTotals(persons, vehicles, !!batch.multipleSubmissionsEnabled);
      if (!totalsCheck.ok) return res.status(totalsCheck.status).json({ success: false, message: totalsCheck.message });

      if (batch.multipleSubmissionsEnabled) {
        // Never below what is already approved or awaiting review — that would
        // strand batches mid-flight.
        const used = await BulkPassSchema.getSubmissionSummary(batch.id, "DEPARTMENT");
        if (req.body.noOfPersons !== undefined && persons < used.countedPersons) {
          return res.status(400).json({
            success: false,
            message: `Max No. of Persons cannot be lower than the ${used.countedPersons} person(s) already approved or awaiting review`,
          });
        }
        if (req.body.noOfVehicles !== undefined && vehicles < (used.countedVehicles ?? 0)) {
          return res.status(400).json({
            success: false,
            message: `Max No. of Vehicles cannot be lower than the ${used.countedVehicles} vehicle(s) already approved or awaiting review`,
          });
        }
        // Keep the legacy mirror column in step.
        if (req.body.noOfPersons !== undefined) req.body.maxTotalPersons = persons;
      }
    }
    // Date + optional "HH:MM" (IST) → the stored instant; a missing time gets
    // the 06:00 / 18:00 default.
    const { validityFromTime, validityUptoTime } = req.body;
    delete req.body.validityFromTime;
    delete req.body.validityUptoTime;
    if (req.body.validityUpto !== undefined) {
      const uptoEnd = combineValidity(req.body.validityUpto, validityUptoTime, { upto: true });
      if (!uptoEnd) {
        return res.status(400).json({ success: false, message: "Invalid validity upto date or time" });
      }
      if (uptoEnd.getTime() <= Date.now()) {
        return res.status(400).json({ success: false, message: "Validity upto must be in the future" });
      }
      req.body.validityUpto = uptoEnd.toISOString();
    }

    // An optional cap on the number of batches, reusable passes only.
    if (req.body.maxSubmissions !== undefined) {
      if (!batch.multipleSubmissionsEnabled) {
        return res.status(400).json({ success: false, message: "A batch cap applies only to reusable (multi-submission) bulk passes" });
      }
      const check = validateCumulativeLimits(req.body.maxSubmissions);
      if (!check.ok) return res.status(check.status).json({ success: false, message: check.message });
      const used = await BulkPassSchema.getSubmissionSummary(batch.id, "DEPARTMENT");
      const newMaxSubmissions = toLimit(req.body.maxSubmissions);
      if (newMaxSubmissions != null && newMaxSubmissions < used.countedSubmissions) {
        return res.status(400).json({
          success: false,
          message: `Max batches cannot be lower than the ${used.countedSubmissions} batch(es) already submitted and not rejected`,
        });
      }
    }
    if (req.body.validityFrom !== undefined && req.body.validityFrom !== null && req.body.validityFrom !== "") {
      const fromStart = combineValidity(req.body.validityFrom, validityFromTime);
      if (!fromStart) {
        return res.status(400).json({ success: false, message: "Invalid validity from date or time" });
      }
      req.body.validityFrom = fromStart.toISOString();
      // Compare against the new validityUpto if provided, else the existing one
      const upto = normalizeValidityUpto(req.body.validityUpto !== undefined ? req.body.validityUpto : batch.validityUpto);
      if (upto && fromStart.getTime() >= upto.getTime()) {
        return res.status(400).json({ success: false, message: "Validity from must be before validity upto" });
      }
    }

    // Map the form's "purposeOfVisit" to the stored "purpose" column.
    if (req.body.purpose === undefined && req.body.purposeOfVisit !== undefined) {
      req.body.purpose = req.body.purposeOfVisit;
    }

    const updated = await BulkPassSchema.updateBatch(id, req.body);

    // Keep the link's own expiry in step with a changed validity window.
    if (req.body.validityUpto !== undefined && batch.multipleSubmissionsEnabled) {
      await BulkPassSchema.setStatus(id, updated.status, { tokenExpiresAt: req.body.validityUpto });
      updated.tokenExpiresAt = req.body.validityUpto;
    }

    const changed = Object.keys(req.body).filter((k) => req.body[k] !== undefined);
    if (changed.length) {
      await BulkPassSchema.logTransition(id, updated.status, req.user.userId, `Details updated: ${changed.join(", ")}`).catch(() => {});
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    console.error("[bulkPass] updateBatch error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/:id/link-status  (protected — Dept User)
 * Body: { active: boolean, reason?: string }
 *
 * Switch an applicant link off (or back on) without waiting for the validity
 * window to close. On a reusable Bulk Pass this stops new batches while the
 * history stays readable; batches already under review are untouched.
 */
exports.setLinkActive = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json({ success: false, message: "Invalid batch ID" });

    const { active, reason } = req.body || {};
    if (typeof active !== "boolean" && active !== "true" && active !== "false") {
      return res.status(400).json({ success: false, message: "active (true/false) is required" });
    }
    const nextActive = active === true || active === "true";

    const batch = await BulkPassSchema.getById(id);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });

    const role = (req.user?.role || "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrator" || role === "super admin" || role === "superadmin";
    if (!isAdmin && batch.createdByUserId !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Only links the applicant could still use are worth switching: a reusable
    // pass, or a single-use link that has not been consumed.
    const switchable = batch.multipleSubmissionsEnabled || CORRECTABLE_STATUSES.includes(batch.status);
    if (!switchable) {
      return res.status(400).json({ success: false, message: "This link has already been used and cannot be switched" });
    }

    if (nextActive && !getLinkState(batch).canSubmit) {
      return res.status(400).json({
        success: false,
        message: "The validity period has ended; extend the validity before reactivating the link",
      });
    }

    const updated = await BulkPassSchema.setTokenActive(id, nextActive);
    await BulkPassSchema.logTransition(
      id,
      updated.status,
      req.user.userId,
      nextActive
        ? `Applicant link reactivated${reason ? `: ${String(reason).trim()}` : ""}`
        : `Applicant link deactivated${reason ? `: ${String(reason).trim()}` : ""}`
    );

    return res.status(200).json({
      success: true,
      message: nextActive ? "Link reactivated" : "Link deactivated",
      data: { id: updated.id, tokenActive: updated.tokenActive, status: updated.status },
    });
  } catch (err) {
    console.error("[bulkPass] setLinkActive error:", err.message);
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
    // `flagged`: [{ id, reason }] — the persons / vehicles that need fixing, each
    // with its own reason, so the applicant sees exactly which rows to correct.
    const flaggedInput = Array.isArray(req.body.flagged) ? req.body.flagged : [];
    const flagged = flaggedInput
      .map((f) => ({ id: Number(f?.id), reason: String(f?.reason || "").trim() }))
      .filter((f) => Number.isInteger(f.id) && f.id > 0);
    if (flagged.some((f) => !f.reason)) {
      return res.status(400).json({ success: false, message: "Give a reason for every person or vehicle you mark for correction" });
    }
    // The overall note is optional once rows are marked; one is written for them.
    const returnReason = String(req.body.returnReason || "").trim() ||
      (flagged.length
        ? `Please correct the ${flagged.length} highlighted ${flagged.length === 1 ? "entry" : "entries"} and resubmit.`
        : "");

    if (!returnReason) {
      return res.status(400).json({ success: false, message: "returnReason is required" });
    }

    const batch = await BulkPassSchema.getById(id);
    if (!batch) {
      return res.status(404).json({ success: false, message: "Batch not found" });
    }
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Only UNDER_REVIEW batches can be returned to applicant" });
    }

    if (flagged.length) {
      const rowIds = new Set(((await BulkPassSchema.getPersonsByBatch(id)) || []).map((r) => Number(r.id)));
      const foreign = flagged.filter((f) => !rowIds.has(f.id));
      if (foreign.length) {
        return res.status(400).json({ success: false, message: "Some marked entries do not belong to this batch" });
      }
      // Marked rows carry the officer's reason into the correction link (the
      // portal highlights REJECTED rows with their approvalReason). The batch's
      // rows are replaced wholesale on resubmission, so nothing lingers.
      for (const f of flagged) {
        await BulkPassSchema.setPersonApprovalStatus(f.id, "REJECTED", f.reason, req.user.userId);
      }
    }

    const updated = await BulkPassSchema.setStatus(id, "RETURNED_TO_APPLICANT", {
      tokenActive: true,
      returnReason,
      tokenExpiresAt: batch.validityUpto,
    });
    await BulkPassSchema.logTransition(
      id, "RETURNED_TO_APPLICANT", req.user.userId,
      flagged.length ? `${returnReason} (${flagged.length} entr${flagged.length === 1 ? "y" : "ies"} marked)` : returnReason
    );

    // Email applicant — log failures but don't block the response
    const correction = await buildCorrectionData(id, returnReason);

    const emailSent = await sendEmail("sendBulkPassReturned", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      returnReason,
      uploadLink: buildUploadLink(batch.token),
      // Name the rows that need attention rather than only the batch.
      issues: correction.issues,
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
    // A link opened for correction comes back fully populated, with the
    // officer's verdict attached to each row.
    if (["RETURNED_TO_APPLICANT", "REJECTED"].includes(batch.status)) {
      responseData.returnReason = batch.returnReason || null;
      responseData.rejectionReason = batch.rejectionReason || null;
      const correction = await buildCorrectionData(
        batch.id,
        batch.returnReason || batch.rejectionReason || null
      );
      Object.assign(responseData, correction);
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
 * Resolves an applicant link into everything the Bulk Pass portal needs in one
 * round trip: the Bulk Pass itself, its validity state, its full submission
 * history and the aggregate statistics across those submissions.
 *
 * Handles three kinds of link:
 *  - bulk_pass_parent_requests            (public website request, always multi)
 *  - bulk_pass_batches, multi enabled     (department-issued reusable link)
 *  - bulk_pass_batches, multi disabled    (legacy single submission)
 *
 * An expired multi-submission Bulk Pass still answers 200. The applicant keeps
 * read access to their submission history for the life of the record; only
 * `canSubmit` flips to false. Single-submission links keep the older, stricter
 * behaviour because there is no history to show once the link is consumed.
 */
exports.validateToken = async (req, res) => {
  try {
    const token = getResolvedToken(req.params.token);
    if (!token) {
      return res.status(400).json({ success: false, message: "Token is required" });
    }

    // ── Step 1: Public website request (bulk_pass_parent_requests) ──
    const BulkPassParentRequest = require("../models/BulkPassParentRequest");
    const parentRequest = await BulkPassParentRequest.findByToken(token);

    if (parentRequest) {
      const gate = await resolveBulkPassGate(parentRequest, "PUBLIC_WEBSITE", {
        identifier: parentRequest.tracking_number,
        isApproved: parentRequest.status === "ACTIVE",
      });
      const { validity, bulkPassView, remaining, blockReason, submissionHistory, submissionSummary, nextSubmissionNumber } = gate;

      const parentRequestView = {
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
      };

      return res.status(200).json({
        success: true,
        data: {
          isParentRequest: true,
          isParentBatch: false,
          multipleSubmissionsEnabled: true,
          withinValidityPeriod: validity.canSubmit,
          canSubmit: gate.canSubmit,
          blockReason,
          message: gate.message,
          validity,
          bulkPass: bulkPassView,
          remaining,
          parentRequest: parentRequestView,
          submissionHistory,
          submissionSummary,
          nextSubmissionNumber,
        },
      });
    }

    // ── Step 2: Department-issued batch link (bulk_pass_batches) ──
    const batch = await BulkPassSchema.getByToken(token);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: "Invalid or inactive token",
      });
    }

    const batchView = {
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
    };

    // ── Step 3: Reusable (multi-submission) Bulk Pass ──
    if (batch.multipleSubmissionsEnabled) {
      const gate = await resolveBulkPassGate(batch, "DEPARTMENT", { identifier: batch.refNo });
      const { validity, bulkPassView, remaining, blockReason, submissionHistory, submissionSummary, nextSubmissionNumber } = gate;

      return res.status(200).json({
        success: true,
        data: {
          isParentRequest: false,
          isParentBatch: true,
          multipleSubmissionsEnabled: true,
          withinValidityPeriod: validity.canSubmit,
          canSubmit: gate.canSubmit,
          blockReason,
          message: gate.message,
          validity,
          bulkPass: bulkPassView,
          remaining,
          batch: batchView,
          submissionHistory,
          submissionSummary,
          nextSubmissionNumber,
        },
      });
    }

    // ── Step 4: A single batch link ──
    // Consumed links stay hard-closed: there is no history to fall back on.
    if (!batch.tokenActive) {
      return res.status(403).json({
        success: false,
        message: "Link expired or inactive",
      });
    }

    // ── Step 4a: A batch that belongs to a reusable Bulk Pass ──
    // Traffic returns an individual batch for correction, which reopens that
    // batch's own link. Resolve the Bulk Pass around it so the applicant keeps
    // the validity, the statistics and the rest of their history in view
    // instead of landing on a bare, context-free form.
    if (batch.parent_request_id) {
      const source = batch.request_source || "DEPARTMENT";
      const parent =
        source === "PUBLIC_WEBSITE"
          ? await BulkPassParentRequest.getById(batch.parent_request_id)
          : await BulkPassSchema.getById(batch.parent_request_id);

      if (parent) {
        // The revision replaces this batch's rows, so they are left out of the
        // remaining-budget figure the form is sized by.
        const [gate, correction] = await Promise.all([
          resolveBulkPassGate(parent, source, {
            identifier: parent.refNo || parent.tracking_number,
            excludeBatchId: batch.id,
          }),
          // Corrections come back populated, so nothing is retyped.
          buildCorrectionData(batch.id, batch.returnReason || batch.rejectionReason || null),
        ]);
        const { validity: parentValidity, bulkPassView, submissionHistory, submissionSummary } = gate;
        const ceilings = perBatchCeilings(bulkPassView.maxPersons != null ? { noOfPersons: bulkPassView.maxPersons, noOfVehicles: bulkPassView.maxVehicles } : parent);

        // A correction is gated by the Bulk Pass around it as well as by the
        // batch's own state: a revoked or expired pass takes no corrections,
        // and a rejected batch must find a free batch slot to come back.
        let blockReason = null;
        if (!CORRECTABLE_STATUSES.includes(batch.status)) blockReason = "NOT_SUBMITTABLE";
        else if (gate.revoked) blockReason = "LINK_INACTIVE";
        else if (!parentValidity.canSubmit) blockReason = parentValidity.state;
        else if (gate.remaining.submissionsRemaining === 0) blockReason = "SUBMISSION_LIMIT_REACHED";
        else if (gate.remaining.personsRemaining === 0) blockReason = "PERSON_LIMIT_REACHED";

        return res.status(200).json({
          success: true,
          data: {
            isParentRequest: false,
            isParentBatch: false,
            multipleSubmissionsEnabled: true,
            // This link revises one batch; it does not open a new one.
            isRevision: true,
            revisionOf: {
              id: batch.id,
              refNo: batch.refNo,
              submissionNumber: batch.submission_number,
              status: batch.status,
              returnReason: batch.returnReason || null,
              rejectionReason: batch.rejectionReason || null,
              issues: correction.issues,
            },
            withinValidityPeriod: parentValidity.canSubmit,
            canSubmit: !blockReason,
            blockReason,
            message: describeBlock(blockReason, parentValidity, bulkPassView, gate.remaining),
            validity: parentValidity,
            bulkPass: bulkPassView,
            remaining: gate.remaining,
            batch: {
              ...batchView,
              // The per-batch ceiling comes from the Bulk Pass, not from the
              // count this batch happened to be submitted with.
              noOfPersons: ceilings.maxPersons,
              noOfVehicles: ceilings.maxVehicles,
              returnReason: batch.returnReason || null,
              rejectionReason: batch.rejectionReason || null,
              linkValidityHours: batch.linkValidityHours,
              tokenExpiresAt: batch.tokenExpiresAt,
              // Pre-fill payload — same shape the single-submission flow uses.
              previousPersons: correction.previousPersons,
              previousVehicles: correction.previousVehicles,
            },
            submissionHistory,
            submissionSummary,
            nextSubmissionNumber: batch.submission_number,
          },
        });
      }
    }

    // ── Step 4b: Legacy single-submission link ──
    const validity = getValidityState(batch);
    return res.status(200).json({
      success: true,
      data: {
        isParentRequest: false,
        isParentBatch: false,
        multipleSubmissionsEnabled: false,
        withinValidityPeriod: true,
        canSubmit: CORRECTABLE_STATUSES.includes(batch.status),
        blockReason: null,
        message: null,
        validity,
        bulkPass: buildBulkPassView(batch, {
          source: batch.request_source || "DEPARTMENT",
          validity,
          identifier: batch.refNo,
        }),
        batch: {
          ...batchView,
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
 * POST /api/bulk-pass/internal/send-expiry-reminders  (internal — x-service-key)
 *
 * One-shot notice to organisations whose Bulk Pass link is about to close, so
 * they can send any remaining batches while it still works. Called daily by
 * approval-admin-service's scheduler.
 *
 * Each pass is stamped once it is notified, so re-running the job — or running
 * it twice in a day — never mails the same organisation again.
 *
 * Body: { days?: number }  (default 3)
 */
exports.sendExpiryReminders = async (req, res) => {
  const days = Number(req.body?.days) > 0 ? Number(req.body.days) : EXPIRY_WARNING_DAYS;

  try {
    const BulkPassParentRequest = require("../models/BulkPassParentRequest");

    const [deptPasses, publicPasses] = await Promise.all([
      BulkPassSchema.findBulkPassesNearingExpiry(days),
      BulkPassParentRequest.findNearingExpiry(days),
    ]);

    const results = { notified: 0, failed: 0, considered: deptPasses.length + publicPasses.length };

    const notify = async ({ identifier, companyName, email, validityUpto, token, submissionsCount, markSent }) => {
      if (!email) return;
      const validity = getValidityState({ validityUpto });
      const sent = await sendEmail("sendBulkPassExpiring", {
        email,
        refNo: identifier,
        companyName,
        validityUpto,
        daysRemaining: validity.daysRemaining,
        submissionsCount,
        uploadLink: buildUploadLink(token),
      });

      if (sent) {
        // Stamp only on success, so a transient email outage retries tomorrow.
        await markSent();
        results.notified += 1;
      } else {
        results.failed += 1;
      }
    };

    for (const p of deptPasses) {
      try {
        await notify({
          identifier: p.refNo,
          companyName: p.companyName,
          email: p.applicantEmail,
          validityUpto: p.validityUpto,
          token: p.token,
          submissionsCount: Number(p.submissionsCount) || 0,
          markSent: () => BulkPassSchema.markExpiryReminderSent(p.id),
        });
      } catch (err) {
        results.failed += 1;
        console.error(`[bulkPass] expiry reminder failed for batch ${p.id}:`, err.message);
      }
    }

    for (const r of publicPasses) {
      try {
        await notify({
          identifier: r.tracking_number,
          companyName: r.company_name,
          email: r.applicant_email,
          validityUpto: r.approved_time_upto,
          token: r.shared_token,
          submissionsCount: Number(r.submissions_count) || 0,
          markSent: () => BulkPassParentRequest.markExpiryReminderSent(r.id),
        });
      } catch (err) {
        results.failed += 1;
        console.error(`[bulkPass] expiry reminder failed for request ${r.id}:`, err.message);
      }
    }

    console.log(
      `[bulkPass] expiry reminders — considered ${results.considered}, notified ${results.notified}, failed ${results.failed}`
    );
    return res.status(200).json({ success: true, data: results });
  } catch (err) {
    return handleBulkPassError(res, err, "Failed to send bulk pass expiry reminders");
  }
};

/**
 * GET /api/bulk-pass/public/:token/submissions  (public — no auth)
 *
 * Submission history + aggregate statistics for the Bulk Pass behind a link.
 * Lets the applicant portal refresh the history after a submission without
 * re-running the whole token validation.
 */
exports.getPublicSubmissions = async (req, res) => {
  try {
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }

    const { batch, isParentRequest, parentRequest } = resolved;
    const source = isParentRequest ? "PUBLIC_WEBSITE" : "DEPARTMENT";

    // A single-submission link has no child batches — report an empty history
    // rather than 404 so the portal can render one consistent shape.
    const isMulti = isParentRequest || batch.multipleSubmissionsEnabled === true;

    if (!isMulti) {
      return res.status(200).json({
        success: true,
        data: {
          multipleSubmissionsEnabled: false,
          validity: getValidityState(batch),
          canSubmit: false,
          blockReason: null,
          message: null,
          remaining: null,
          submissionHistory: [],
          submissionSummary: { totalSubmissions: 0, totalPersons: 0, totalVehicles: 0, countedSubmissions: 0, countedPersons: 0, approvedPersons: 0, pendingPersons: 0, rejectedPersons: 0, byStatus: {}, lastSubmissionAt: null },
          nextSubmissionNumber: 1,
        },
      });
    }

    const parent = isParentRequest ? parentRequest : batch;
    const gate = await resolveBulkPassGate(parent, source, {
      isApproved: isParentRequest ? parentRequest.status === "ACTIVE" : true,
    });

    return res.status(200).json({
      success: true,
      data: {
        multipleSubmissionsEnabled: true,
        validity: gate.validity,
        canSubmit: gate.canSubmit,
        blockReason: gate.blockReason,
        message: gate.message,
        remaining: gate.remaining,
        bulkPass: gate.bulkPassView,
        submissionHistory: gate.submissionHistory,
        submissionSummary: gate.submissionSummary,
        nextSubmissionNumber: gate.nextSubmissionNumber,
      },
    });
  } catch (err) {
    console.error("[bulkPass] getPublicSubmissions error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Resolve a returned batch through the Bulk Pass link that owns it, so the
 * applicant can correct it from their dashboard instead of hunting for the
 * per-batch email. Answers either `{ child }` or `{ status, body }` to send.
 *
 * Only a batch the Traffic Department returned for revision qualifies, and it
 * must belong to this exact pass (same parent id AND same source — department
 * and public-request ids live in different tables and can collide).
 */
async function resolveOwnedCorrection(req) {
  const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
  if (!resolved || !resolved.batch) {
    return { status: 404, body: { success: false, message: "Invalid link" } };
  }
  const { batch, isParentRequest, parentRequest } = resolved;
  if (!isParentRequest && batch.multipleSubmissionsEnabled !== true) {
    return { status: 400, body: { success: false, message: "This link has no batches to correct" } };
  }

  const submissionId = Number(req.params.submissionId);
  if (!submissionId || Number.isNaN(submissionId)) {
    return { status: 400, body: { success: false, message: "Invalid submission ID" } };
  }

  const parentId = isParentRequest ? parentRequest.id : batch.id;
  const source = isParentRequest ? "PUBLIC_WEBSITE" : "DEPARTMENT";
  const child = await BulkPassSchema.getChildBatchById(parentId, submissionId);
  if (!child || (child.request_source || "DEPARTMENT") !== source) {
    return { status: 404, body: { success: false, message: "Submission not found for this bulk pass" } };
  }
  if (child.status !== "RETURNED_TO_APPLICANT" || !child.tokenActive || !child.token) {
    return {
      status: 409,
      body: {
        success: false,
        message: "This batch is not open for correction.",
        data: { blockReason: "NOT_SUBMITTABLE" },
      },
    };
  }
  return { child };
}

/**
 * GET /api/bulk-pass/public/:token/submissions/:submissionId/correction  (public — no auth)
 *
 * The correction payload for one returned batch, fetched through the Bulk
 * Pass link. Identical to opening that batch's own correction link — it runs
 * the same handler — so gating, pre-fill and the officer's flags all match.
 */
exports.getPublicSubmissionCorrection = async (req, res) => {
  try {
    const owned = await resolveOwnedCorrection(req);
    if (!owned.child) return res.status(owned.status).json(owned.body);
    req.params.token = encryptToken(owned.child.token);
    return exports.validateToken(req, res);
  } catch (err) {
    console.error("[bulkPass] getPublicSubmissionCorrection error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * POST /api/bulk-pass/public/:token/submissions/:submissionId/submit-rows  (public — no auth)
 *
 * Resubmit a returned batch from the Bulk Pass dashboard. Runs the regular
 * submit-rows handler against that batch's own link, so a correction made here
 * is validated, budgeted and stored exactly like one made from the email link.
 */
exports.submitPublicSubmissionCorrection = async (req, res) => {
  try {
    const owned = await resolveOwnedCorrection(req);
    if (!owned.child) return res.status(owned.status).json(owned.body);
    req.params.token = encryptToken(owned.child.token);
    return exports.submitRowsDirectly(req, res);
  } catch (err) {
    console.error("[bulkPass] submitPublicSubmissionCorrection error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/public/:token/submissions/:submissionId  (public — no auth)
 *
 * Detail of one previous batch, readable only through the Bulk Pass link that
 * owns it. Aadhaar numbers are masked and document paths withheld — the
 * applicant is confirming what they sent, not re-downloading identity records.
 */
exports.getPublicSubmissionDetail = async (req, res) => {
  try {
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }

    const { batch, isParentRequest, parentRequest } = resolved;
    const parentId = isParentRequest ? parentRequest.id : batch.id;

    const submissionId = Number(req.params.submissionId);
    if (!submissionId || Number.isNaN(submissionId)) {
      return res.status(400).json({ success: false, message: "Invalid submission ID" });
    }

    const submission = await BulkPassSchema.getChildBatchById(parentId, submissionId);
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found for this bulk pass" });
    }

    const [rows, statusLog] = await Promise.all([
      BulkPassSchema.getPersonsByBatch(submission.id),
      BulkPassSchema.getStatusLog(submission.id),
    ]);

    const maskAadhaar = (a) => {
      const s = String(a || "").replace(/\s+/g, "");
      return s.length >= 4 ? `XXXX XXXX ${s.slice(-4)}` : s || null;
    };
    const isVehicleRow = (r) => !!(r.vehicleNumber && String(r.vehicleNumber).trim() !== "");

    const persons = rows.filter((r) => !isVehicleRow(r)).map((p) => ({
      id: p.id,
      name: p.name,
      aadhaar: maskAadhaar(p.aadhaar),
      dob: p.dob,
      mobile: p.mobile,
      inCharge: p.inCharge === true,
      approvalStatus: p.approvalStatus || "PENDING",
      approvalReason: p.approvalReason || null,
    }));

    const vehicles = rows.filter(isVehicleRow).map((v) => ({
      id: v.id,
      vehicleNumber: v.vehicleNumber,
      vehicleType: v.vehicleType || null,
      driverName: v.name || null,
      driverMobile: v.mobile || null,
      driverLicenseNumber: v.driverLicenseNumber || null,
      approvalStatus: v.approvalStatus || "PENDING",
      approvalReason: v.approvalReason || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        submission: {
          id: submission.id,
          refNo: submission.refNo,
          submissionNumber: submission.submission_number,
          requestSource: submission.request_source,
          status: submission.status,
          personsCount: persons.length,
          vehiclesCount: vehicles.length,
          validityFrom: submission.validityFrom,
          validityUpto: submission.validityUpto,
          submittedAt: submission.submittedAt || submission.createdAt,
          createdAt: submission.createdAt,
          updatedAt: submission.updatedAt,
          returnReason: submission.returnReason || null,
          rejectionReason: submission.rejectionReason || null,
          // The approved pass (QR PDF) can be downloaded through this link.
          passAvailable: submission.status === "COMPLETED" && !!submission.qrPdfPath,
        },
        persons,
        vehicles,
        statusLog: (statusLog || []).map((l) => ({
          status: l.status,
          remarks: l.remarks,
          createdAt: l.createdAt,
        })),
      },
    });
  } catch (err) {
    console.error("[bulkPass] getPublicSubmissionDetail error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /api/bulk-pass/public/:token/submissions/:submissionId/pdf  (public — no auth)
 *
 * The approved pass for one batch, downloadable through the Bulk Pass link
 * that owns it. Traffic's approval email carries the same PDF, but the
 * applicant should not have to dig through their inbox for every batch when
 * the history on the portal already lists them.
 */
exports.getPublicSubmissionPdf = async (req, res) => {
  try {
    const resolved = await findBatchOrParentRequestByToken(getResolvedToken(req.params.token));
    if (!resolved || !resolved.batch) {
      return res.status(404).json({ success: false, message: "Invalid link" });
    }

    const { batch, isParentRequest, parentRequest } = resolved;
    const parentId = isParentRequest ? parentRequest.id : batch.id;

    const submissionId = Number(req.params.submissionId);
    if (!submissionId || Number.isNaN(submissionId)) {
      return res.status(400).json({ success: false, message: "Invalid submission ID" });
    }

    // A batch inside this Bulk Pass — or, on a single-submission link, the
    // batch the link itself belongs to.
    let submission = await BulkPassSchema.getChildBatchById(parentId, submissionId);
    if (!submission && !isParentRequest && !batch.multipleSubmissionsEnabled && batch.id === submissionId) {
      submission = await BulkPassSchema.getById(submissionId);
    }
    if (!submission) {
      return res.status(404).json({ success: false, message: "Submission not found for this bulk pass" });
    }

    if (submission.status !== "COMPLETED") {
      return res.status(400).json({
        success: false,
        message: "The pass is issued once the Traffic Department approves this batch.",
      });
    }

    const absolutePath = submission.qrPdfPath ? path.resolve(submission.qrPdfPath) : null;
    if (!absolutePath || !fs.existsSync(absolutePath)) {
      return res.status(404).json({
        success: false,
        message: "The pass document is still being prepared. Please try again shortly or contact the issuing department.",
      });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${(submission.refNo || `batch-${submission.id}`).replace(/[^A-Za-z0-9._-]/g, "_")}.pdf"`);
    return res.sendFile(absolutePath);
  } catch (err) {
    console.error("[bulkPass] getPublicSubmissionPdf error:", err.message);
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
/*
==========================================
Visitor type of the Bulk Pass a submission belongs to. A public-website pass
keeps it on the parent request, a department pass on the batch itself.
Drives the student mobile / in-charge rule (see BULK_PASS_LIMITS.MIN_STUDENT_INCHARGE).
==========================================
*/
const resolvePassVisitorType = ({ parent, parentRequest, batch }) =>
  (parent && (parent.visitor_type || parent.visitorType)) ||
  (parentRequest && (parentRequest.visitor_type || parentRequest.visitorType)) ||
  (batch && (batch.visitorType || batch.visitor_type)) ||
  null;

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

    const result = await parseAndValidate(filePaths, fileNames || filePaths.map((p) => path.basename(p)), {
      mobileOptional: isStudentVisitorType(resolvePassVisitorType(resolved)),
    });
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
  // Retired: superseded by POST /public/:token/submit-rows (submitRowsDirectly).
  // The old implementation validated blacklist / per-batch caps / cumulative budget
  // against body-supplied counts while persisting rows re-parsed from the Excel,
  // skipped link-revocation and approval checks, ran without the per-pass advisory
  // lock, and never persisted vehicles. It is unused by the app, so it is disabled
  // rather than left publicly reachable with those holes.
  return res.status(410).json({
    success: false,
    message: "This endpoint has been retired. Use POST /public/:token/submit-rows instead.",
  });
};

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

    const parseResult = await parseAndValidate(filePaths, fileNames, {
      mobileOptional: isStudentVisitorType(resolvePassVisitorType(resolved)),
    });
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

    // The batch's own window decides whether the pass is usable today — a
    // batch dated for next week must not open the gate this week.
    const scanValidity = getValidityState(batch);
    if (scanValidity.state === "EXPIRED" || scanValidity.state === "NOT_STARTED") {
      const notStarted = scanValidity.state === "NOT_STARTED";
      return res.status(403).json({
        success: false,
        message: notStarted
          ? `This pass is not valid yet. It can be used from ${formatValidityDateTime(scanValidity.validityFrom)}.`
          : "This pass has expired.",
        data: {
          expired: !notStarted,
          notStarted,
          refNo: batch.refNo,
          validityFrom: batch.validityFrom,
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
      // Both persons and vehicle rows go through per-row approval (a Traffic
      // officer can reject an individual vehicle). Show only APPROVED rows —
      // exactly what getApprovedPersonsByBatch puts on the issued pass PDF, so
      // the scan view can't advertise a vehicle that isn't on the pass.
      .filter((p) => p.approvalStatus === "APPROVED")
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
    // Idempotent: a stale screen (another tab, or a page restored after going
    // back) may offer Undo on a row that is already pending — that is the
    // state the officer asked for, so report success rather than an error.
    if (!person.approvalStatus || person.approvalStatus === "PENDING") {
      return res.status(200).json({ success: true, data: person });
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
 * POST /api/bulk-pass/:batchId/persons/approve-all  (internal — approval-admin-service)
 *
 * Approve every entry still awaiting a decision. Reviewing a thirty-person
 * batch one row at a time is the single biggest cost in the traffic queue, and
 * the common case is that everything is in order. Rows the officer has already
 * rejected are left untouched.
 */
exports.approveAllPendingInBatch = async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);
    if (!batchId || isNaN(batchId)) {
      return res.status(400).json({ success: false, message: "Invalid batch ID" });
    }

    const { approvedBy } = req.body;

    const batch = await BulkPassSchema.getById(batchId);
    if (!batch) return res.status(404).json({ success: false, message: "Batch not found" });
    if (batch.status !== "UNDER_REVIEW") {
      return res.status(400).json({ success: false, message: "Batch is not under review" });
    }

    const approvedCount = await BulkPassSchema.approveAllPending(batchId, approvedBy || null);
    const summary = await BulkPassSchema.getPersonApprovalSummary(batchId);

    return res.status(200).json({
      success: true,
      message: `${approvedCount} entr${approvedCount === 1 ? "y" : "ies"} approved`,
      data: { approvedCount, summary },
    });
  } catch (err) {
    return handleBulkPassError(res, err, "Failed to approve remaining entries");
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

    // Don't issue a pass whose validity window has already closed:
    // getPublicScanData would immediately reject it as expired, leaving the
    // applicant "approved" yet holding an unusable pass.
    const uptoEnd = normalizeValidityUpto(batch.validityUpto);
    if (uptoEnd && new Date(uptoEnd).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Validity window has closed. Extend the validity before finalizing.",
      });
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

    // Atomic transition: only the caller that flips UNDER_REVIEW → COMPLETED wins.
    // Two concurrent finalizes would otherwise both pass the status check above
    // and each send an approval email / generate a pass. Gate everything below on
    // actually having made the transition.
    const finalizeResult = await pool.query(
      `UPDATE "bulk_pass_batches"
       SET "status" = 'COMPLETED', "qrPdfPath" = $2, "updatedAt" = NOW()
       WHERE "id" = $1 AND "status" = 'UNDER_REVIEW'
       RETURNING *`,
      [id, qrPdfPath || null]
    );
    if (finalizeResult.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Batch is no longer awaiting review (it may already have been finalized).",
      });
    }
    const updated = finalizeResult.rows[0];
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
      qrLink: FRONTEND_BASE ? buildPassViewLink(batch.id) : null,
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

    // A rejection reopens the applicant's link rather than ending the road.
    // The applicant gets their data back with every flagged row explained, so
    // correcting is editing rather than starting over. The department can still
    // close it for good with Return/Reject once satisfied.
    const updated = await BulkPassSchema.setStatus(id, "REJECTED", {
      rejectionReason: rejectionReason.trim(),
      tokenActive: true,
      tokenExpiresAt: batch.validityUpto,
    });
    await BulkPassSchema.logTransition(id, "REJECTED", rejectedBy || null, rejectionReason.trim());

    const correction = await buildCorrectionData(id, rejectionReason.trim());

    sendEmail("sendBulkPassRejected", {
      email: batch.applicantEmail,
      refNo: batch.refNo,
      companyName: batch.companyName,
      rejectionReason: rejectionReason.trim(),
      // Everything the applicant needs to act, in the email itself.
      uploadLink: buildUploadLink(batch.token),
      issues: correction.issues,
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

    // A reusable Bulk Pass stays open for as long as its validity window does —
    // the gate is the window, not the one-shot tokenActive flag used by legacy
    // single-submission links. A returned or rejected batch inside such a pass
    // is a *revision*: it replaces its own rows rather than adding a batch, and
    // it is gated by the pass around it exactly like a new batch would be.
    const isMultiSubmission = isParentRequest || batch.multipleSubmissionsEnabled === true;
    const isRevision = !isMultiSubmission && !!batch.parent_request_id;

    let parent = null;
    let parentSource = null;
    if (isParentRequest) {
      parent = parentRequest;
      parentSource = "PUBLIC_WEBSITE";
    } else if (batch.multipleSubmissionsEnabled) {
      parent = batch;
      parentSource = "DEPARTMENT";
    } else if (isRevision) {
      parentSource = batch.request_source || "DEPARTMENT";
      parent =
        parentSource === "PUBLIC_WEBSITE"
          ? await require("../models/BulkPassParentRequest").getById(batch.parent_request_id)
          : await BulkPassSchema.getById(batch.parent_request_id);
    }

    if (isParentRequest && parentRequest.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "This bulk pass request has not been approved yet.",
        data: { blockReason: "NOT_APPROVED" },
      });
    }

    if (parent) {
      const validity = getLinkState(parent);
      if (!validity.canSubmit) {
        return res.status(403).json({
          success: false,
          message: getBlockedMessage(validity),
          data: { blockReason: validity.state, validity },
        });
      }
      // An explicitly revoked link closes the Bulk Pass early — for new
      // batches and for corrections alike.
      if (isRevoked(parent, parentSource, validity)) {
        return res.status(403).json({
          success: false,
          message: "This bulk pass link has been deactivated. Please contact the issuing department.",
          data: { blockReason: "LINK_INACTIVE" },
        });
      }
    } else if (isLinkExpired(batch)) {
      return res.status(403).json({ success: false, message: "Link expired or inactive" });
    }

    // Every batch under a Bulk Pass carries its own visit window, chosen by the
    // applicant inside the pass window. A legacy single-batch link keeps the
    // dates its department set.
    let batchWindow = null;
    if (parent) {
      batchWindow = resolveBatchValidity(
        {
          validityFrom: req.body.validityFrom,
          validityUpto: req.body.validityUpto,
          validityFromTime: req.body.validityFromTime,
          validityUptoTime: req.body.validityUptoTime,
        },
        parent
      );
      if (!batchWindow.ok) {
        return res.status(400).json({
          success: false,
          message: batchWindow.error,
          data: {
            blockReason: "INVALID_BATCH_VALIDITY",
            field: batchWindow.field,
            bounds: getBatchValidityBounds(parent),
          },
        });
      }
    }

    if (!isMultiSubmission && !CORRECTABLE_STATUSES.includes(batch.status)) {
      return res.status(400).json({
        success: false,
        message: "Batch is not in a submittable state",
        data: { blockReason: "NOT_SUBMITTABLE" },
      });
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
    if (!Array.isArray(vehicleMeta)) vehicleMeta = [];

    // The Bulk Pass ceilings apply per batch: a reusable pass allows this many
    // persons/vehicles in every submission, not in total across all of them.
    // A revision inherits the pass's ceiling, not the head-count it happened
    // to be submitted with the first time. The system maximum always applies.
    const { maxPersons, maxVehicles } = perBatchCeilings(parent || batch);

    if (rows.length > maxPersons) {
      return res.status(400).json({
        success: false,
        message: `Cannot submit: ${rows.length} persons exceed the ${maxPersons} allowed in one batch. Please split them across batches.`,
        data: { blockReason: "PER_BATCH_PERSON_LIMIT", maxPersons },
      });
    }

    if (vehicleMeta.length > maxVehicles) {
      return res.status(400).json({
        success: false,
        message:
          maxVehicles === 0
            ? "Cannot submit: this bulk pass does not allow vehicles. Please remove the vehicle entries."
            : `Cannot submit: ${vehicleMeta.length} vehicles exceed the ${maxVehicles} allowed in one batch. Please split them across batches.`,
        data: { blockReason: "PER_BATCH_VEHICLE_LIMIT", maxVehicles },
      });
    }

    // Everything from here on reads the Bulk Pass's current position and then
    // writes to it, so submissions against one pass run in single file.
    const runSerialised = parent
      ? (fn) => withBulkPassLock(parent, parentSource, fn)
      : (fn) => fn();

    return await runSerialised(async () => {
      // ── Cumulative budget for the whole Bulk Pass ───────────────────────────
      // Separate from the per-batch ceiling above: this is the total the issuing
      // department is prepared to let through the link over its whole life.
      // Rejected persons and rejected batches do not count; a revision leaves
      // its own rows out since they are about to be replaced.
      if (parent) {
        const budgetBlock = await checkBulkPassBudget(parent, parentSource, rows.length, {
          excludeBatchId: isRevision ? batch.id : null,
          vehicleCount: vehicleMeta.filter((v) => v && v.regNo).length,
        });
        if (budgetBlock) return res.status(budgetBlock.status).json(budgetBlock.body);
      }

      const {
        validateAadhaar, validateMobile, validateDOB,
      } = require("../utils/bulkPassValidators");
      const { validateEmbeddedPhoto } = require("../services/photoValidationService");

      // ── Validate persons ────────────────────────────────────────────────────
      // A student group does not need a mobile number per head. It names 1–2
      // in-charge persons (teacher / escort) instead, and each in-charge must
      // have a mobile. Every other visitor type needs a mobile per person and
      // has no in-charge.
      const mobileOptional = isStudentVisitorType(
        resolvePassVisitorType({ parent, parentRequest, batch })
      );
      // The flag only means anything on a student batch; never store it elsewhere.
      for (const row of rows) row.inCharge = mobileOptional && (row.inCharge === true || row.inCharge === "true");
      const inChargeCount = rows.filter((r) => r.inCharge).length;

      const errors = [];
      const seenAadhaar = new Set();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowLabel = `Row ${i + 1}`;

        if (!row.name || !row.name.trim()) { errors.push({ index: i, message: `${rowLabel}: Name is required` }); continue; }

        // Normalize once and key the dedup Set on the normalized value — the same
        // form the row is validated and stored in (and the cross-batch query
        // compares). Keying on raw row.aadhaar let "1234 5678 9012" and
        // "123456789012" both pass and insert as a duplicate person.
        const normalizedAadhaar = String(row.aadhaar || "").replace(/\s+/g, "");
        const aadhaarRes = validateAadhaar(normalizedAadhaar);
        if (!aadhaarRes.valid) { errors.push({ index: i, message: `${rowLabel}: ${aadhaarRes.error}` }); continue; }

        if (seenAadhaar.has(normalizedAadhaar)) { errors.push({ index: i, message: `${rowLabel}: Duplicate Aadhaar` }); continue; }
        seenAadhaar.add(normalizedAadhaar);

        const dobRes = validateDOB(row.dob || "");
        if (!dobRes.valid) { errors.push({ index: i, message: `${rowLabel}: ${dobRes.error}` }); continue; }

        // Spaces are formatting, not part of the number — the form strips them
        // too, so "98765 43210" must not pass there and fail here.
        const mobile = String(row.mobile || "").replace(/\s+/g, "");
        row.mobile = mobile;
        if (row.inCharge && !mobile) {
          errors.push({ index: i, message: `${rowLabel}: Mobile number is required for an in-charge` }); continue;
        }
        if (mobile || !mobileOptional) {
          const mobRes = validateMobile(mobile);
          if (!mobRes.valid) { errors.push({ index: i, message: `${rowLabel}: ${mobRes.error}` }); continue; }
        }

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

      if (mobileOptional) {
        const { MIN_STUDENT_INCHARGE: min, MAX_INCHARGE_PER_BATCH: max } = BULK_PASS_LIMITS;
        if (inChargeCount < min || inChargeCount > max) {
          return res.status(400).json({
            success: false,
            message: inChargeCount < min
              ? `A student batch needs at least ${min} in-charge (teacher or escort) with a mobile number. Tick "In-charge" for them.`
              : `A batch can have at most ${max} in-charge persons — ${inChargeCount} are ticked.`,
            data: { blockReason: "STUDENT_INCHARGE_REQUIRED", min, max, provided: inChargeCount },
          });
        }
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
          validityFrom: batchWindow.validityFrom.toISOString(),
          validityUpto: batchWindow.validityUpto.toISOString(),
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
          validityFrom: batchWindow.validityFrom.toISOString(),
          validityUpto: batchWindow.validityUpto.toISOString(),
          noOfPersons: rows.length,
          noOfVehicles: vehicleMeta.length,
          purpose: batch.purpose || "Department Bulk Pass Submission",
          paymentMode: batch.paymentMode || "CASH",
        };
        targetBatch = await BulkPassSchema.createBatch(childBatchData);
      } else {
        await BulkPassSchema.deletePersonsByBatch(targetBatch.id);
        // A correction may move the batch's dates as well as its rows.
        if (batchWindow) {
          await BulkPassSchema.updateBatch(targetBatch.id, {
            validityFrom: batchWindow.validityFrom.toISOString(),
            validityUpto: batchWindow.validityUpto.toISOString(),
          });
        }
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
                mobile: String(row.mobile || "").trim() || null,
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
          mobile: String(row.mobile || "").trim() || null,
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
        submissionNumber: isChildSubmission ? submissionNumber : undefined,
      }).catch(() => {});

      // Report the refreshed Bulk Pass position so the applicant portal can show
      // the updated history, the remaining allowance and whether another batch
      // is still possible — the same answer validate-token would give.
      let gate = null;
      if (parent) {
        try {
          gate = await resolveBulkPassGate(parent, parentSource, {
            isApproved: isParentRequest ? parentRequest.status === "ACTIVE" : true,
          });
        } catch (summaryErr) {
          console.error("[bulkPass] submission summary refresh failed:", summaryErr.message);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Batch submitted successfully",
        data: {
          id: targetBatch.id,
          refNo: targetBatch.refNo,
          personsSubmitted: personRows.length,
          vehiclesSubmitted: vehicleRows.length,
          status: "UNDER_REVIEW",
          validityFrom: batchWindow ? batchWindow.validityFrom.toISOString() : targetBatch.validityFrom || null,
          validityUpto: batchWindow ? batchWindow.validityUpto.toISOString() : targetBatch.validityUpto || null,
          submissionNumber: isRevision ? batch.submission_number || submissionNumber : submissionNumber,
          isMultipleSubmission: isChildSubmission,
          isRevision,
          // A correction link belongs to one batch; further batches go through
          // the Bulk Pass link itself, so this link offers no "another batch".
          canSubmitMore: isRevision ? false : gate ? gate.canSubmit : false,
          blockReason: isRevision ? "NOT_SUBMITTABLE" : gate ? gate.blockReason : null,
          message: isRevision
            ? "Your correction has been sent for review. To submit further batches, open the bulk pass link from your invitation email."
            : gate ? gate.message : null,
          validity: gate ? gate.validity : null,
          remaining: gate ? gate.remaining : null,
          submissionSummary: gate ? gate.submissionSummary : null,
          nextSubmissionNumber: gate ? gate.nextSubmissionNumber : null,
        },
      });
    }); // runSerialised
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
    const [childBatches, submissionSummary] = await Promise.all([
      BulkPassSchema.getChildBatches(parentId, 'DEPARTMENT'),
      BulkPassSchema.getSubmissionSummary(parentId, 'DEPARTMENT'),
    ]);

    const validity = getLinkState(parentBatch);
    const bulkPassView = buildBulkPassView(parentBatch, { source: "DEPARTMENT", validity, identifier: parentBatch.refNo });
    const remaining = buildRemaining(bulkPassView, submissionSummary);

    return res.status(200).json({
      success: true,
      parentBatch: {
        id: parentBatch.id,
        refNo: parentBatch.refNo,
        companyName: parentBatch.companyName,
        departmentName: parentBatch.departmentName,
        visitorType: parentBatch.visitorType,
        applicantEmail: parentBatch.applicantEmail,
        multipleSubmissionsEnabled: parentBatch.multipleSubmissionsEnabled,
        maxPersons: parentBatch.noOfPersons,
        maxVehicles: parentBatch.noOfVehicles,
        maxSubmissions: bulkPassView.maxSubmissions,
        maxTotalPersons: bulkPassView.maxTotalPersons,
        maxTotalVehicles: bulkPassView.maxTotalVehicles,
        perBatchMaxPersons: BULK_PASS_LIMITS.MAX_PERSONS_PER_BATCH,
        perBatchMaxVehicles: BULK_PASS_LIMITS.MAX_VEHICLES_PER_BATCH,
        tokenActive: parentBatch.tokenActive,
        validityFrom: parentBatch.validityFrom,
        validityUpto: parentBatch.validityUpto,
        status: parentBatch.status,
      },
      validity,
      remaining,
      // Counts come from the persons actually stored against each child batch,
      // so management sees what was submitted rather than what was declared.
      submissions: childBatches.map((b) => ({
        id: b.id,
        submissionNumber: b.submissionNumber,
        refNo: b.refNo,
        personsCount: b.personsCount,
        vehiclesCount: b.vehiclesCount,
        declaredPersons: b.noOfPersons || 0,
        declaredVehicles: b.noOfVehicles || 0,
        approvedPersonsCount: b.approvedPersonsCount,
        rejectedPersonsCount: b.rejectedPersonsCount,
        pendingPersonsCount: b.pendingPersonsCount,
        approvedVehiclesCount: b.approvedVehiclesCount,
        rejectedVehiclesCount: b.rejectedVehiclesCount,
        status: b.status,
        validityFrom: b.validityFrom,
        validityUpto: b.validityUpto,
        submittedAt: b.submittedAt || b.createdAt,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
      submissionSummary,
      totalSubmissions: childBatches.length,
    });
  } catch (err) {
    console.error("[bulkPass] getChildSubmissions error:", err.message);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
