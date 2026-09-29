/**
 * bulkPassValidity.js
 *
 * Single source of truth for Bulk Pass validity handling.
 *
 * A Bulk Pass is a long-lived container: one link, one validity window, and any
 * number of batch submissions inside that window. Every surface (applicant
 * portal, department console, traffic approval) must agree on when that window
 * is open, so the rules live here instead of being re-derived per controller.
 *
 * Rules:
 *  - `validityFrom` is optional. When absent the window is open from creation.
 *  - `validityUpto` is treated as date-only (no time component required).
 *    Any validity date is automatically extended to 23:59:59.999 of that day
 *    to ensure the pass remains valid throughout the entire day.
 *  - A pass is ACTIVE only between those two instants.
 */

// A pass is flagged as nearing expiry inside this window so the applicant has
// time to send a final batch before the link closes.
const EXPIRY_WARNING_DAYS = 3;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The port operates on IST (UTC+05:30, no DST). Validity dates entered as a bare
// day are anchored to IST so "valid upto 30 Sep" stays usable through the end of
// 30 Sep IST — the same instant on every server, regardless of its timezone.
const IST_OFFSET_MS = 330 * 60 * 1000;

/**
 * Parse a date-ish value into a Date, or null when unusable.
 */
function toDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Normalise the end of a validity window. All dates are treated as date-only
 * (no time component) and automatically extended to end of day (23:59:59.999)
 * so a pass valid "upto 30 Sep" stays usable throughout the entire day.
 */
function normalizeValidityUpto(value) {
  const d = toDate(value);
  if (!d) return null;
  
  // Always treat as date-only and extend to END of that day in IST
  // This ensures consistent behavior regardless of how the date was stored
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  const endUtcMs =
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 23, 59, 59, 999) - IST_OFFSET_MS;
  return new Date(endUtcMs);
}

/**
 * Pull the validity window off any Bulk Pass shaped object.
 * Handles the camelCase batch rows, the snake_case parent-request rows, and the
 * approved_time_* window that a General Administrator sets when approving a
 * public request (which takes precedence over the requested window).
 */
function resolveValidityWindow(source) {
  if (!source) return { validityFrom: null, validityUpto: null };

  const from =
    source.validityFrom ??
    source.approved_time_from ??
    source.validity_from ??
    null;

  const upto =
    source.validityUpto ??
    source.approved_time_upto ??
    source.validity_upto ??
    null;

  return { validityFrom: toDate(from), validityUpto: normalizeValidityUpto(upto) };
}

/**
 * Describe the validity of a Bulk Pass at this instant.
 *
 * @returns {{
 *   state: 'ACTIVE' | 'NOT_STARTED' | 'EXPIRED' | 'UNKNOWN',
 *   expiringSoon: boolean,
 *   daysRemaining: number | null,
 *   validityFrom: string | null,
 *   validityUpto: string | null,
 *   canSubmit: boolean
 * }}
 */
function getValidityState(source, now = new Date()) {
  const { validityFrom, validityUpto } = resolveValidityWindow(source);
  const at = toDate(now) || new Date();

  if (!validityUpto) {
    return {
      state: "UNKNOWN",
      expiringSoon: false,
      daysRemaining: null,
      validityFrom: validityFrom ? validityFrom.toISOString() : null,
      validityUpto: null,
      canSubmit: false,
    };
  }

  const base = {
    validityFrom: validityFrom ? validityFrom.toISOString() : null,
    validityUpto: validityUpto.toISOString(),
  };

  if (validityFrom && at.getTime() < validityFrom.getTime()) {
    return { ...base, state: "NOT_STARTED", expiringSoon: false, daysRemaining: null, canSubmit: false };
  }

  const msRemaining = validityUpto.getTime() - at.getTime();
  if (msRemaining < 0) {
    return { ...base, state: "EXPIRED", expiringSoon: false, daysRemaining: 0, canSubmit: false };
  }

  const daysRemaining = Math.ceil(msRemaining / MS_PER_DAY);
  return {
    ...base,
    state: "ACTIVE",
    expiringSoon: daysRemaining <= EXPIRY_WARNING_DAYS,
    daysRemaining,
    canSubmit: true,
  };
}

/**
 * True when a new batch may still be submitted against this Bulk Pass.
 */
function isWithinValidity(source, now = new Date()) {
  return getValidityState(source, now).canSubmit;
}

/**
 * Applicant-facing explanation for a closed submission window.
 * Returns null while the window is open.
 */
function getBlockedMessage(validity) {
  if (!validity) return "This bulk pass link is no longer accepting submissions.";
  switch (validity.state) {
    case "EXPIRED":
      return "This bulk pass has expired. New submissions are no longer accepted, but your previous submissions remain available below.";
    case "NOT_STARTED":
      return "The submission period for this bulk pass has not started yet.";
    case "UNKNOWN":
      return "This bulk pass does not have a valid submission period. Please contact the issuing department.";
    default:
      return null;
  }
}

module.exports = {
  EXPIRY_WARNING_DAYS,
  toDate,
  normalizeValidityUpto,
  resolveValidityWindow,
  getValidityState,
  isWithinValidity,
  getBlockedMessage,
};
