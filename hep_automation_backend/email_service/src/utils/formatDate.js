/**
 * formatDate.js — email date formatting
 *
 * Bulk pass dispatchers pass raw DB `Date` objects / ISO strings (e.g.
 * "2026-09-30T00:00:00.000Z") or plain "YYYY-MM-DD" values straight into the
 * templates, which previously interpolated them verbatim — customers saw
 * "Valid Until: 2026-09-30T00:00:00.000Z". Format them as "30 Sep 2026" in the
 * port's timezone (IST) instead. Null/invalid values return the fallback.
 */
function formatValidityDate(value, fallback = "—") {
  if (value === null || value === undefined || value === "") return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

const IST_OFFSET_MS = 330 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A bulk pass validity instant as "30 Sep 2026, 18:00" (IST). A bulk pass
 * window is a date + time (default 06:00 – 18:00). A legacy bare-date upto
 * (stored as midnight) means the end of that day, matching user_service's
 * normalizeValidityUpto.
 */
function formatValidityDateTime(value, { fallback = "—", upto = false } = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  let d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  if (upto && ((d.getTime() + IST_OFFSET_MS) % MS_PER_DAY === 0 || d.getTime() % MS_PER_DAY === 0)) {
    const ist = new Date(d.getTime() + IST_OFFSET_MS);
    d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate(), 23, 59, 59, 999) - IST_OFFSET_MS);
  }
  const iso = new Date(d.getTime() + IST_OFFSET_MS).toISOString();
  return `${iso.slice(8, 10)} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}, ${iso.slice(11, 16)}`;
}

module.exports = { formatValidityDate, formatValidityDateTime };
