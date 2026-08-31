/**
 * dataMasking.js
 * ---------------------------------------------------------
 * Centralized PII masking + role-gating utilities.
 * Fixes: "Excessive Sensitive Data Exposure to Authenticated Users"
 * (OWASP A01:2021 / CWE-200)
 *
 * Import this into passRequestModel.js (or wherever you return
 * API responses containing agent/person/vehicle data) and apply
 * it right before `return` in the relevant functions.
 *
 * IMPORTANT: This file only MASKS/FILTERS data that is already
 * fetched. It does not change any SQL query, so nothing about
 * your existing DB logic, joins, or workflow state changes.
 * ---------------------------------------------------------
 */

// ─────────────────────────────────────────────
// 1. Roles allowed to see FULL (unmasked) contact info
//    (email / mobile / GSTIN / PAN / Aadhar)
//
//    ⚠️ YOU MUST CONFIRM THIS LIST.
//    Based on the code you shared, I only saw these roles:
//    "Approval", "Safety Officer", "Fire Safety Officer",
//    "Senior Deputy Traffic Manager".
//    None of them obviously need to see agent GSTIN/PAN or
//    full applicant Aadhar numbers to do their job (approving
//    persons/vehicles for gate passes) — but I don't have full
//    context on your business process, so nothing is force-masked
//    for Aadhar/GSTIN/PAN below unless you add roles here.
// ─────────────────────────────────────────────
const FULL_PII_ROLES = new Set([ "Admin"
  // Add roles here that legitimately need unmasked email/mobile.
  // e.g. "Super Admin", "System Admin"
]);

function canSeeFullPII(role) {
  return FULL_PII_ROLES.has(role);
}

// ─────────────────────────────────────────────
// 2. Masking primitives
// ─────────────────────────────────────────────
function maskEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) return email;
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0] || ""}***@${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

function maskMobile(mobile) {
  if (!mobile || typeof mobile !== "string") return mobile;
  const digits = mobile.replace(/\D/g, "");
  if (digits.length < 6) return "*".repeat(digits.length);
  return `${digits.slice(0, 5)}${"*".repeat(digits.length - 5)}`;
}

function maskAadhar(aadhar) {
  if (!aadhar || typeof aadhar !== "string") return aadhar;
  const digits = aadhar.replace(/\D/g, "");
  if (digits.length < 4) return "*".repeat(digits.length);
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function maskGSTIN(gstin) {
  if (!gstin || typeof gstin !== "string") return gstin;
  if (gstin.length < 6) return "*".repeat(gstin.length);
  return `${gstin.slice(0, 2)}${"*".repeat(gstin.length - 4)}${gstin.slice(-2)}`;
}

function maskPAN(pan) {
  if (!pan || typeof pan !== "string") return pan;
  if (pan.length < 4) return "*".repeat(pan.length);
  return `${pan.slice(0, 2)}${"*".repeat(pan.length - 4)}${pan.slice(-2)}`;
}

// ─────────────────────────────────────────────
// 3. Fields to strip completely from LIST/DETAIL API responses
//    (operational/internal metadata — should never reach the client
//    in these payloads; move behind dedicated, authorized endpoints
//    if actually needed)
// ─────────────────────────────────────────────
const STRIP_FIELDS = ["token", "qrPdfPath", "qrUuid"];

function stripInternalFields(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clone = { ...obj };
  for (const field of STRIP_FIELDS) {
    if (field in clone) delete clone[field];
  }
  return clone;
}

// ─────────────────────────────────────────────
// 4. High-level sanitizers — apply to full response rows
// ─────────────────────────────────────────────

/**
 * Sanitize a single "pass request" style row that has agent-level
 * contact fields (email, mobileNo, gstinNumber, panNumber) plus
 * nested persons[] / vehicles[] arrays.
 *
 * @param {object} row - a single pass request record
 * @param {string} requesterRole - role of the user making the API call
 */
function sanitizePassRequestRow(row, requesterRole) {
  if (!row) return row;

  const fullAccess = canSeeFullPII(requesterRole);
  const out = stripInternalFields({ ...row });

  // Agent-level contact fields
  if (out.email !== undefined) {
    out.email = fullAccess ? out.email : maskEmail(out.email);
  }
  if (out.mobileNo !== undefined) {
    out.mobileNo = fullAccess ? out.mobileNo : maskMobile(out.mobileNo);
  }
  if (out.gstinNumber !== undefined) {
    out.gstinNumber = fullAccess ? out.gstinNumber : maskGSTIN(out.gstinNumber);
  }
  if (out.panNumber !== undefined) {
    out.panNumber = fullAccess ? out.panNumber : maskPAN(out.panNumber);
  }
  if (out.agentEmail !== undefined) {
    out.agentEmail = fullAccess ? out.agentEmail : maskEmail(out.agentEmail);
  }
  if (out.agentMobile !== undefined) {
    out.agentMobile = fullAccess ? out.agentMobile : maskMobile(out.agentMobile);
  }

  // Nested persons[]
  if (Array.isArray(out.persons)) {
    out.persons = out.persons.map((p) => sanitizePersonRecord(p, fullAccess));
  }

  // Nested vehicles[] — no PII fields today (registration/QR references aren't
  // personal data), so left as-is. Add masking here if you add owner
  // contact fields to vehicles later.

  return out;
}

/**
 * Sanitize a single person sub-record (from persons[] arrays).
 */
function sanitizePersonRecord(person, fullAccess) {
  if (!person) return person;
  const out = { ...person };

  if (out.email !== undefined) {
    out.email = fullAccess ? out.email : maskEmail(out.email);
  }
  if (out.mobile !== undefined) {
    out.mobile = fullAccess ? out.mobile : maskMobile(out.mobile);
  }
  // Aadhar is a government ID — mask it unless the role is explicitly
  // trusted for physical identity verification. Uncomment to enforce:
  // if (out.aadharNo !== undefined) {
  //   out.aadharNo = fullAccess ? out.aadharNo : maskAadhar(out.aadharNo);
  // }

  return out;
}

module.exports = {
  FULL_PII_ROLES,
  canSeeFullPII,
  maskEmail,
  maskMobile,
  maskAadhar,
  maskGSTIN,
  maskPAN,
  stripInternalFields,
  sanitizePassRequestRow,
  sanitizePersonRecord,
};
