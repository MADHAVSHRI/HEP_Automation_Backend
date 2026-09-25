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

module.exports = { formatValidityDate };
