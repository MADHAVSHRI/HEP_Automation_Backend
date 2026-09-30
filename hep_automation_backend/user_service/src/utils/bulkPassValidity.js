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
 *  - `validityFrom` is date-only too: it opens at 00:00 IST of that day.
 *  - A pass is ACTIVE only between those two instants.
 *
 * Each batch submitted under a Bulk Pass carries its own window, chosen by the
 * applicant. It must sit inside the pass window and must not start in the past
 * — see `resolveBatchValidity`.
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
 * The IST calendar day of a date-ish value as "YYYY-MM-DD", or null.
 * A bare "YYYY-MM-DD" (what a date input yields) is that IST day as-is.
 */
function toIstDateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const key = value.trim();
    const d = new Date(`${key}T00:00:00Z`);
    // Reject impossible days ("2026-02-31") instead of rolling them over.
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key ? key : null;
  }
  const d = toDate(value);
  if (!d) return null;
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function istDayBoundary(key, endOfDay) {
  const [y, m, d] = key.split("-").map(Number);
  const utcMs = endOfDay ? Date.UTC(y, m - 1, d, 23, 59, 59, 999) : Date.UTC(y, m - 1, d);
  return new Date(utcMs - IST_OFFSET_MS);
}

/**
 * Normalise the start of a validity window to 00:00 IST of that day, so a pass
 * valid "from 1 Oct" is usable from the first minute of 1 Oct in the port.
 */
function normalizeValidityFrom(value) {
  const key = toIstDateKey(value);
  return key ? istDayBoundary(key, false) : null;
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

  return { validityFrom: normalizeValidityFrom(from), validityUpto: normalizeValidityUpto(upto) };
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

/**
 * The earliest and latest day ("YYYY-MM-DD", IST) an applicant may choose for a
 * batch under this Bulk Pass: from today or the pass start, whichever is later,
 * up to the pass end. `min > max` means no day is left to choose.
 */
function getBatchValidityBounds(pass, now = new Date()) {
  const { validityFrom, validityUpto } = resolveValidityWindow(pass);
  const today = toIstDateKey(now);
  const passFrom = validityFrom ? toIstDateKey(validityFrom) : null;
  return {
    min: passFrom && passFrom > today ? passFrom : today,
    max: validityUpto ? toIstDateKey(validityUpto) : null,
  };
}

/**
 * Validate the window an applicant chose for one batch against its Bulk Pass.
 *
 * @param {{ validityFrom, validityUpto }} input  dates as entered (date-only)
 * @param {Object} pass  parent batch / parent request row
 * @returns {{ ok: true, validityFrom: Date, validityUpto: Date }
 *         | { ok: false, field: 'validityFrom'|'validityUpto', error: string }}
 */
function resolveBatchValidity(input, pass, now = new Date()) {
  const fromKey = toIstDateKey(input?.validityFrom);
  const uptoKey = toIstDateKey(input?.validityUpto);
  if (!fromKey) return { ok: false, field: "validityFrom", error: "Please enter a valid 'Valid From' date for this batch." };
  if (!uptoKey) return { ok: false, field: "validityUpto", error: "Please enter a valid 'Valid To' date for this batch." };

  const { min, max } = getBatchValidityBounds(pass, now);
  if (fromKey < min) {
    return { ok: false, field: "validityFrom", error: `'Valid From' cannot be earlier than ${formatDateKey(min)}.` };
  }
  if (uptoKey < fromKey) {
    return { ok: false, field: "validityUpto", error: "'Valid To' cannot be earlier than 'Valid From'." };
  }
  if (max && uptoKey > max) {
    return { ok: false, field: "validityUpto", error: `'Valid To' cannot be later than the bulk pass validity (${formatDateKey(max)}).` };
  }
  return { ok: true, validityFrom: istDayBoundary(fromKey, false), validityUpto: istDayBoundary(uptoKey, true) };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateKey(key) {
  const [y, m, d] = key.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

module.exports = {
  EXPIRY_WARNING_DAYS,
  toDate,
  toIstDateKey,
  normalizeValidityFrom,
  normalizeValidityUpto,
  getBatchValidityBounds,
  resolveBatchValidity,
  formatDateKey,
  resolveValidityWindow,
  getValidityState,
  isWithinValidity,
  getBlockedMessage,
};
