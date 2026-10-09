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
 *  - A window is a date plus a time of day, both in IST. The time defaults to
 *    06:00 (from) and 18:00 (upto) when only a date is given, and the user may
 *    change it. An upto time is inclusive of its whole minute (HH:MM:59.999).
 *  - Legacy rows stored as a bare date (midnight) keep their old meaning: from
 *    opens at 00:00 IST, upto runs to the end of that IST day.
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

// Default time of day for a bulk pass window when only a date is chosen.
const DEFAULT_VALIDITY_FROM_TIME = "06:00";
const DEFAULT_VALIDITY_UPTO_TIME = "18:00";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * The IST calendar day of a date-ish value as "YYYY-MM-DD", or null.
 * A bare "YYYY-MM-DD" (what a date input yields) is that IST day as-is.
 */
function toIstDateKey(value) {
  if (typeof value === "string" && DATE_KEY_RE.test(value.trim())) {
    const key = value.trim();
    const d = new Date(`${key}T00:00:00Z`);
    // Reject impossible days ("2026-02-31") instead of rolling them over.
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === key ? key : null;
  }
  const d = toDate(value);
  if (!d) return null;
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** A valid "HH:MM" (24h) time, or null. */
function toTimeKey(value) {
  if (typeof value !== "string") return null;
  const t = value.trim().slice(0, 5);
  return TIME_KEY_RE.test(t) ? t : null;
}

/** The IST time of day of an instant as "HH:MM", or null. */
function toIstTimeKey(value) {
  const d = toDate(value);
  if (!d) return null;
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(11, 16);
}

/**
 * The instant for an IST day + "HH:MM". An upto instant covers its whole
 * minute (HH:MM:59.999), so "valid upto 18:00" is usable through 18:00, and it
 * can never be mistaken for a legacy bare-date midnight.
 */
function istDateTime(dateKey, timeKey, { upto = false } = {}) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = timeKey.split(":").map(Number);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, upto ? 59 : 0, upto ? 999 : 0);
  return new Date(utcMs - IST_OFFSET_MS);
}

function istDayBoundary(key, endOfDay) {
  const [y, m, d] = key.split("-").map(Number);
  const utcMs = endOfDay ? Date.UTC(y, m - 1, d, 23, 59, 59, 999) : Date.UTC(y, m - 1, d);
  return new Date(utcMs - IST_OFFSET_MS);
}

const isIstMidnight = (d) => (d.getTime() + IST_OFFSET_MS) % MS_PER_DAY === 0;
const isUtcMidnight = (d) => d.getTime() % MS_PER_DAY === 0;

/**
 * Build the instant to store for one end of a window from a date and an
 * optional "HH:MM". A missing time falls back to the 06:00 / 18:00 default. A
 * full timestamp (no separate time) is taken as-is. Returns null when unusable.
 */
function combineValidity(dateValue, timeValue, { upto = false } = {}) {
  const fallback = upto ? DEFAULT_VALIDITY_UPTO_TIME : DEFAULT_VALIDITY_FROM_TIME;
  const isBareDate = typeof dateValue === "string" && DATE_KEY_RE.test(dateValue.trim());
  if (!isBareDate && timeValue == null) {
    const d = toDate(dateValue);
    if (!d) return null;
    return upto ? normalizeValidityUpto(d) : d;
  }
  const dateKey = toIstDateKey(dateValue);
  if (!dateKey) return null;
  const timeKey = timeValue == null || timeValue === "" ? fallback : toTimeKey(timeValue);
  if (!timeKey) return null;
  return istDateTime(dateKey, timeKey, { upto });
}

/**
 * Normalise the end of a validity window to the instant it closes.
 *  - a bare "YYYY-MM-DD" closes at the default 18:00 IST of that day;
 *  - a legacy bare date stored as midnight (IST or UTC) closes at the end of
 *    that IST day, as it always has;
 *  - any other instant is the chosen date + time and is kept as-is.
 */
function normalizeValidityUpto(value) {
  if (typeof value === "string" && DATE_KEY_RE.test(value.trim())) {
    const key = toIstDateKey(value);
    return key ? istDateTime(key, DEFAULT_VALIDITY_UPTO_TIME, { upto: true }) : null;
  }
  const d = toDate(value);
  if (!d) return null;
  if (isIstMidnight(d) || isUtcMidnight(d)) return istDayBoundary(toIstDateKey(d), true);
  return d;
}

/**
 * Normalise the start of a validity window to the instant it opens.
 *  - a bare "YYYY-MM-DD" opens at the default 06:00 IST of that day;
 *  - any stored instant is kept (a legacy midnight already means 00:00 IST).
 */
function normalizeValidityFrom(value) {
  if (typeof value === "string" && DATE_KEY_RE.test(value.trim())) {
    const key = toIstDateKey(value);
    return key ? istDateTime(key, DEFAULT_VALIDITY_FROM_TIME) : null;
  }
  return toDate(value);
}

/** "DD/MM/YYYY HH:MM" in IST — how a validity instant is printed on a pass. */
function formatValidityDateTime(value) {
  const d = toDate(value);
  if (!d) return "";
  const [y, m, day] = toIstDateKey(d).split("-");
  return `${day}/${m}/${y} ${toIstTimeKey(d)}`;
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
 * The applicant LINK's state: open from the moment the link was issued until
 * the pass expires — so an organisation can send batches ahead of the visit
 * window. The pass's own validityFrom still bounds the visit dates a batch may
 * choose (resolveBatchValidity) and when the gate accepts it (scan), but it no
 * longer keeps the link closed.
 *
 * The link opens at creation (department pass) or approval (public request).
 * Returns the getValidityState shape; `validityFrom` stays the pass's visit
 * start for display, and `linkOpensAt` is when submissions opened.
 */
function getLinkState(source, now = new Date()) {
  if (!source) return getValidityState(source, now);
  const linkOpensAt = toDate(source.approved_at ?? source.createdAt ?? source.created_at ?? null);
  const { validityFrom, validityUpto } = resolveValidityWindow(source);
  const state = getValidityState(
    { validityFrom: linkOpensAt ? linkOpensAt.toISOString() : null, validityUpto: validityUpto ? validityUpto.toISOString() : null },
    now
  );
  return {
    ...state,
    validityFrom: validityFrom ? validityFrom.toISOString() : null,
    linkOpensAt: linkOpensAt ? linkOpensAt.toISOString() : null,
    visitsNotStarted: !!validityFrom && (toDate(now) || new Date()).getTime() < validityFrom.getTime(),
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
 * @param {{ validityFrom, validityUpto, validityFromTime?, validityUptoTime? }} input
 *   dates as entered ("YYYY-MM-DD") plus optional "HH:MM" times, which default
 *   to 06:00 / 18:00 IST
 * @param {Object} pass  parent batch / parent request row
 * @returns {{ ok: true, validityFrom: Date, validityUpto: Date }
 *         | { ok: false, field: 'validityFrom'|'validityUpto', error: string }}
 */
function resolveBatchValidity(input, pass, now = new Date()) {
  const fromKey = toIstDateKey(input?.validityFrom);
  const uptoKey = toIstDateKey(input?.validityUpto);
  if (!fromKey) return { ok: false, field: "validityFrom", error: "Please enter a valid 'Valid From' date for this batch." };
  if (!uptoKey) return { ok: false, field: "validityUpto", error: "Please enter a valid 'Valid To' date for this batch." };

  const fromTime = input?.validityFromTime ? toTimeKey(input.validityFromTime) : DEFAULT_VALIDITY_FROM_TIME;
  const uptoTime = input?.validityUptoTime ? toTimeKey(input.validityUptoTime) : DEFAULT_VALIDITY_UPTO_TIME;
  if (!fromTime) return { ok: false, field: "validityFrom", error: "Please enter a valid 'Valid From' time for this batch." };
  if (!uptoTime) return { ok: false, field: "validityUpto", error: "Please enter a valid 'Valid To' time for this batch." };

  const from = istDateTime(fromKey, fromTime);
  const upto = istDateTime(uptoKey, uptoTime, { upto: true });
  const { validityFrom: passFrom, validityUpto: passUpto } = resolveValidityWindow(pass);
  const { min, max } = getBatchValidityBounds(pass, now);

  if (fromKey < min) {
    return { ok: false, field: "validityFrom", error: `'Valid From' cannot be earlier than ${formatDateKey(min)}.` };
  }
  if (passFrom && from.getTime() < passFrom.getTime()) {
    return { ok: false, field: "validityFrom", error: `'Valid From' cannot be earlier than the bulk pass validity (${formatValidityDateTime(passFrom)}).` };
  }
  if (upto.getTime() <= from.getTime()) {
    return { ok: false, field: "validityUpto", error: "'Valid To' must be later than 'Valid From'." };
  }
  if ((max && uptoKey > max) || (passUpto && upto.getTime() > passUpto.getTime())) {
    return { ok: false, field: "validityUpto", error: `'Valid To' cannot be later than the bulk pass validity (${formatValidityDateTime(passUpto)}).` };
  }
  if (upto.getTime() < (toDate(now) || new Date()).getTime()) {
    return { ok: false, field: "validityUpto", error: "'Valid To' time has already passed." };
  }
  return { ok: true, validityFrom: from, validityUpto: upto };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDateKey(key) {
  const [y, m, d] = key.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

module.exports = {
  EXPIRY_WARNING_DAYS,
  DEFAULT_VALIDITY_FROM_TIME,
  DEFAULT_VALIDITY_UPTO_TIME,
  toDate,
  toIstDateKey,
  toTimeKey,
  toIstTimeKey,
  combineValidity,
  formatValidityDateTime,
  normalizeValidityFrom,
  normalizeValidityUpto,
  getBatchValidityBounds,
  resolveBatchValidity,
  formatDateKey,
  resolveValidityWindow,
  getValidityState,
  getLinkState,
  isWithinValidity,
  getBlockedMessage,
};
