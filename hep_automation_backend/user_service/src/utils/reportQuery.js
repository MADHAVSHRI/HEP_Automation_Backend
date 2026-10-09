/**
 * reportQuery.js — shared helpers for raw-SQL report/analytics queries.
 *
 * Mirrors the helpers used by models/reportSchema.js so new analytics endpoints
 * behave the same way (limits, sort order, IST time-of-day windows) without
 * touching the existing report module.
 */

const MAX_REPORT_LIMIT = 500;
const MAX_EXPORT_ROWS = 50000;
const IST = "Asia/Kolkata";

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLimit(value) {
  return Math.min(toPositiveInt(value, 50), MAX_REPORT_LIMIT);
}

function normalizeSortOrder(value) {
  return String(value || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";
}

function cleanText(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/** Upper-case, whitespace-stripped form used for vehicle / container matching. */
function normalizeIdentifier(value) {
  return cleanText(value).replace(/\s+/g, "").toUpperCase();
}

/** SQL expression producing the same normalisation as normalizeIdentifier(). */
function sqlNorm(column) {
  return `REPLACE(UPPER(${column}), ' ', '')`;
}

/**
 * Adds an inclusive IST calendar-date range on a timestamptz expression.
 * fromDate / toDate are 'YYYY-MM-DD' strings interpreted in IST.
 */
function addDateRange(where, params, timestampExpression, filters = {}) {
  const fromDate = cleanText(filters.fromDate);
  const toDate = cleanText(filters.toDate);
  if (fromDate) {
    params.push(fromDate);
    where.push(
      `${timestampExpression} >= ($${params.length}::timestamp AT TIME ZONE '${IST}')`,
    );
  }
  if (toDate) {
    params.push(toDate);
    where.push(
      `${timestampExpression} < (($${params.length}::date + INTERVAL '1 day')::timestamp AT TIME ZONE '${IST}')`,
    );
  }
}

/** Adds an IST time-of-day window (supports ranges that wrap past midnight). */
function addLocalTimeFilters(where, params, timestampExpression, filters = {}) {
  const fromTime = cleanText(filters.fromTime);
  const toTime = cleanText(filters.toTime);
  const localTime = `(${timestampExpression} AT TIME ZONE '${IST}')::time`;
  if (fromTime && toTime) {
    params.push(fromTime, toTime);
    const fromIndex = params.length - 1;
    const toIndex = params.length;
    if (fromTime > toTime) {
      where.push(`(${localTime} >= $${fromIndex}::time OR ${localTime} <= $${toIndex}::time)`);
    } else {
      where.push(`${localTime} BETWEEN $${fromIndex}::time AND $${toIndex}::time`);
    }
  } else if (fromTime) {
    params.push(fromTime);
    where.push(`${localTime} >= $${params.length}::time`);
  } else if (toTime) {
    params.push(toTime);
    where.push(`${localTime} <= $${params.length}::time`);
  }
}

/** Case-insensitive equality filter. */
function addEquals(where, params, column, value, { caseInsensitive = true } = {}) {
  const v = cleanText(value);
  if (!v) return;
  params.push(v);
  where.push(
    caseInsensitive
      ? `LOWER(${column}) = LOWER($${params.length})`
      : `${column} = $${params.length}`,
  );
}

/** Accepts a single value or comma-separated list → IN (...) filter. */
function addIn(where, params, column, value) {
  const list = Array.isArray(value) ? value : cleanText(value).split(",");
  const values = list.map((v) => cleanText(v)).filter(Boolean);
  if (!values.length) return;
  const placeholders = values.map((v) => {
    params.push(v.toLowerCase());
    return `$${params.length}`;
  });
  where.push(`LOWER(${column}) IN (${placeholders.join(", ")})`);
}

/** ILIKE %value% filter. */
function addLike(where, params, column, value) {
  const v = cleanText(value);
  if (!v) return;
  params.push(`%${v}%`);
  where.push(`${column} ILIKE $${params.length}`);
}

/** Equality on the normalised (upper, no spaces) form of an identifier column. */
function addNormalizedEquals(where, params, column, value) {
  const v = normalizeIdentifier(value);
  if (!v) return;
  params.push(v);
  where.push(`${sqlNorm(column)} = $${params.length}`);
}

/** Prefix/contains match on the normalised identifier form. */
function addNormalizedLike(where, params, column, value) {
  const v = normalizeIdentifier(value);
  if (!v) return;
  params.push(`%${v}%`);
  where.push(`${sqlNorm(column)} LIKE $${params.length}`);
}

/** Resolves a whitelisted sort expression. */
function resolveSort(sortMap, sortBy, defaultKey) {
  const key = cleanText(sortBy);
  return sortMap[key] || sortMap[defaultKey];
}

/** IST display expressions used in SELECT lists. */
const istDate = (expr) => `TO_CHAR(${expr} AT TIME ZONE '${IST}', 'DD/MM/YYYY')`;
const istTime = (expr) => `TO_CHAR(${expr} AT TIME ZONE '${IST}', 'HH24:MI')`;
const istDateTime = (expr) => `TO_CHAR(${expr} AT TIME ZONE '${IST}', 'DD/MM/YYYY HH24:MI')`;

module.exports = {
  MAX_REPORT_LIMIT,
  MAX_EXPORT_ROWS,
  IST,
  toPositiveInt,
  normalizeLimit,
  normalizeSortOrder,
  cleanText,
  normalizeIdentifier,
  sqlNorm,
  addDateRange,
  addLocalTimeFilters,
  addEquals,
  addIn,
  addLike,
  addNormalizedEquals,
  addNormalizedLike,
  resolveSort,
  istDate,
  istTime,
  istDateTime,
};
