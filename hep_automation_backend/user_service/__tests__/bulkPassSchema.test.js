/**
 * Property-Based Tests for bulkPassSchema.js data layer logic.
 *
 * Tests the pure logic components (reference number format, default field
 * values, list sort/filter contracts) without requiring a live DB connection.
 *
 * Uses fast-check for property-based testing (minimum 100 runs per property).
 */

const fc = require("fast-check");

// ---------------------------------------------------------------------------
// Pure helper functions extracted from the schema modules under test
// These mirror the exact logic inside bulkPassSchema.js / referenceNumberSchema.js
// ---------------------------------------------------------------------------

/**
 * Mirrors generateBulkPassReference logic from referenceNumberSchema.js.
 */
function formatBulkPassReference(count, date) {
  const padded = String(count).padStart(4, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `BLK${day}${month}${year}${padded}`;
}

/**
 * Mirrors the default-value assignments in BulkPassSchema.createBatch.
 */
function applyCreateBatchDefaults(data) {
  return {
    refNo: data.refNo,
    token: data.token,
    tokenActive: data.tokenActive !== undefined ? data.tokenActive : true,
    createdByUserId: data.createdByUserId,
    departmentId: data.departmentId,
    departmentName: data.departmentName,
    visitorType: data.visitorType,
    companyName: data.companyName,
    applicantEmail: data.applicantEmail,
    applicantMobile: data.applicantMobile,
    refDocNo: data.refDocNo || null,
    workOrderRequired:
      data.workOrderRequired !== undefined ? !!data.workOrderRequired : false,
    noOfPersons: Number(data.noOfPersons) || 0,
    noOfVehicles: Number(data.noOfVehicles) || 0,
    paymentMode: data.paymentMode || "CASH",
    passType: data.passType || "MULTIPLE",
    purpose: data.purpose,
    validityUpto: data.validityUpto,
    remarks: data.remarks || null,
    status: data.status || "DRAFT",
  };
}

/**
 * Mirrors the ORDER BY createdAt DESC applied by BulkPassSchema.list.
 */
function sortBatchesNewestFirst(batches) {
  return [...batches].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
}

/**
 * Mirrors the WHERE clause logic of BulkPassSchema.list.
 */
function applyListFilters(batches, filters) {
  return batches.filter((b) => {
    if (
      filters.createdByUserId !== undefined &&
      b.createdByUserId !== filters.createdByUserId
    )
      return false;
    if (filters.status !== undefined && b.status !== filters.status)
      return false;
    if (
      filters.companyName !== undefined &&
      !b.companyName.toLowerCase().includes(filters.companyName.toLowerCase())
    )
      return false;
    if (
      filters.fromDate !== undefined &&
      new Date(b.createdAt) < new Date(filters.fromDate)
    )
      return false;
    if (
      filters.toDate !== undefined &&
      new Date(b.createdAt) > new Date(`${filters.toDate} 23:59:59`)
    )
      return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Arbitraries — no filter() calls to avoid infinite rejection loops
// ---------------------------------------------------------------------------

const VALID_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "RETURNED_TO_APPLICANT",
  "REJECTED",
  "COMPLETED",
];

const VALID_VISITOR_TYPES = [
  "CRUISE_VESSEL",
  "EDUCATIONAL_VISIT",
  "INTERNSHIP",
  "VIP",
  "GOVT_OFFICIAL",
  "OTHER",
];

/** Counter value 1–9999 */
const arbCounter = fc.integer({ min: 1, max: 9999 });

/** Calendar date in a realistic range — guard against Invalid Date from shrinking */
const arbDate = fc
  .date({
    min: new Date("2024-01-01"),
    max: new Date("2030-12-31"),
  })
  .map((d) => (isNaN(d.getTime()) ? new Date("2025-01-01") : d));

/**
 * A valid intake payload — all fields generated cleanly without filter().
 */
const arbValidIntakeData = fc.record({
  // Build refNo directly from counter + date to guarantee format
  refNo: fc.tuple(arbCounter, arbDate).map(([c, d]) =>
    formatBulkPassReference(c, d)
  ),
  token: fc.base64String({ minLength: 12, maxLength: 24 }),
  createdByUserId: fc.integer({ min: 1, max: 10000 }),
  departmentId: fc.integer({ min: 1, max: 100 }),
  departmentName: fc.string({ minLength: 1, maxLength: 100 }),
  visitorType: fc.constantFrom(...VALID_VISITOR_TYPES),
  companyName: fc.string({ minLength: 1, maxLength: 200 }),
  // Build email from parts to guarantee valid format
  applicantEmail: fc
    .tuple(
      fc.stringMatching(/^[a-z0-9]{1,10}$/),
      fc.stringMatching(/^[a-z0-9]{1,10}$/),
      fc.constantFrom("com", "net", "org", "in")
    )
    .map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
  // Build mobile as exactly 10 digits starting with 6–9
  applicantMobile: fc
    .tuple(
      fc.constantFrom("6", "7", "8", "9"),
      fc.stringMatching(/^[0-9]{9}$/)
    )
    .map(([first, rest]) => `${first}${rest}`),
  purpose: fc.string({ minLength: 1, maxLength: 200 }),
  validityUpto: fc
    .date({
      min: new Date(Date.now() + 86400000),
      max: new Date("2030-12-31"),
    })
    .map((d) => (isNaN(d.getTime()) ? new Date("2027-01-01") : d).toISOString()),
  noOfPersons: fc.integer({ min: 0, max: 50 }),
  noOfVehicles: fc.integer({ min: 0, max: 20 }),
});

/** A batch record as it would come back from the DB */
const arbBatchRecord = fc.record({
  id: fc.integer({ min: 1, max: 100000 }),
  refNo: fc.tuple(arbCounter, arbDate).map(([c, d]) =>
    formatBulkPassReference(c, d)
  ),
  status: fc.constantFrom(...VALID_STATUSES),
  companyName: fc.string({ minLength: 1, maxLength: 200 }),
  createdByUserId: fc.integer({ min: 1, max: 10000 }),
  createdAt: arbDate.map((d) => d.toISOString()),
});

// ---------------------------------------------------------------------------
// Property 1: Batch creation produces a valid BLK reference and DRAFT status
// **Feature: bulk-pass-module, Property 1: Batch creation produces a valid BLK reference and DRAFT status**
// **Validates: Requirements 1.1, 1.9**
// ---------------------------------------------------------------------------

describe("Property 1 — BLK reference format and DRAFT default", () => {
  test("formatBulkPassReference matches /^BLK\\d{10}$/ for any counter and date", () => {
    fc.assert(
      fc.property(arbCounter, arbDate, (count, date) => {
        const ref = formatBulkPassReference(count, date);
        return /^BLK\d{10}$/.test(ref);
      }),
      { numRuns: 100 }
    );
  });

  test("createBatch defaults produce status=DRAFT when no status is supplied", () => {
    fc.assert(
      fc.property(arbValidIntakeData, (data) => {
        const { status: _omit, ...withoutStatus } = data;
        const row = applyCreateBatchDefaults(withoutStatus);
        return row.status === "DRAFT";
      }),
      { numRuns: 100 }
    );
  });

  test("createBatch defaults produce tokenActive=true when not explicitly set", () => {
    fc.assert(
      fc.property(arbValidIntakeData, (data) => {
        const { tokenActive: _omit, ...withoutToken } = data;
        const row = applyCreateBatchDefaults(withoutToken);
        return row.tokenActive === true;
      }),
      { numRuns: 100 }
    );
  });

  test("createBatch preserves refNo exactly as supplied", () => {
    fc.assert(
      fc.property(
        arbValidIntakeData,
        fc.tuple(arbCounter, arbDate).map(([c, d]) => formatBulkPassReference(c, d)),
        (data, refNo) => {
          const row = applyCreateBatchDefaults({ ...data, refNo });
          return row.refNo === refNo;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: List ordering — batches always returned newest-first
// **Feature: bulk-pass-module, Property 5: List ordering — batches always returned newest-first**
// **Validates: Requirements 2.1**
// ---------------------------------------------------------------------------

describe("Property 5 — List ordering: batches returned newest-first", () => {
  test("sorted result satisfies descending createdAt for any batch array", () => {
    fc.assert(
      fc.property(
        fc.array(arbBatchRecord, { minLength: 0, maxLength: 50 }),
        (batches) => {
          const sorted = sortBatchesNewestFirst(batches);
          for (let i = 1; i < sorted.length; i++) {
            if (new Date(sorted[i - 1].createdAt) < new Date(sorted[i].createdAt))
              return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("sorting is idempotent — sorting twice equals sorting once", () => {
    fc.assert(
      fc.property(
        fc.array(arbBatchRecord, { minLength: 0, maxLength: 50 }),
        (batches) => {
          const once = sortBatchesNewestFirst(batches);
          const twice = sortBatchesNewestFirst(once);
          if (once.length !== twice.length) return false;
          return once.every((b, i) => b.createdAt === twice[i].createdAt);
        }
      ),
      { numRuns: 100 }
    );
  });

  test("sort preserves all records — no records are added or dropped", () => {
    fc.assert(
      fc.property(
        fc.array(arbBatchRecord, { minLength: 0, maxLength: 50 }),
        (batches) => {
          const sorted = sortBatchesNewestFirst(batches);
          return sorted.length === batches.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Filter predicate — every returned record satisfies applied filters
// **Feature: bulk-pass-module, Property 6: Filter predicate — every returned record satisfies applied filters**
// **Validates: Requirements 2.2**
// ---------------------------------------------------------------------------

describe("Property 6 — Filter predicate: every returned record satisfies filters", () => {
  const arbOptionalStatus = fc.option(
    fc.constantFrom(...VALID_STATUSES),
    { nil: undefined }
  );
  const arbOptionalUserId = fc.option(
    fc.integer({ min: 1, max: 20 }),
    { nil: undefined }
  );
  // Use short strings that are more likely to appear in generated companyNames
  const arbOptionalCompany = fc.option(
    fc.constantFrom("a", "b", "c", "test", "co"),
    { nil: undefined }
  );

  const arbFilters = fc.record({
    status: arbOptionalStatus,
    createdByUserId: arbOptionalUserId,
    companyName: arbOptionalCompany,
  });

  test("every record in the filtered result satisfies all applied filters", () => {
    fc.assert(
      fc.property(
        fc.array(arbBatchRecord, { minLength: 0, maxLength: 50 }),
        arbFilters,
        (batches, filters) => {
          const result = applyListFilters(batches, filters);
          for (const record of result) {
            if (
              filters.status !== undefined &&
              record.status !== filters.status
            )
              return false;
            if (
              filters.createdByUserId !== undefined &&
              record.createdByUserId !== filters.createdByUserId
            )
              return false;
            if (
              filters.companyName !== undefined &&
              !record.companyName
                .toLowerCase()
                .includes(filters.companyName.toLowerCase())
            )
              return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("every record excluded by filters fails at least one filter predicate", () => {
    fc.assert(
      fc.property(
        fc.array(arbBatchRecord, { minLength: 0, maxLength: 50 }),
        arbFilters,
        (batches, filters) => {
          const includedIds = new Set(
            applyListFilters(batches, filters).map((b) => b.id)
          );
          const excluded = batches.filter((b) => !includedIds.has(b.id));

          for (const record of excluded) {
            const statusOk =
              filters.status === undefined ||
              record.status === filters.status;
            const userOk =
              filters.createdByUserId === undefined ||
              record.createdByUserId === filters.createdByUserId;
            const companyOk =
              filters.companyName === undefined ||
              record.companyName
                .toLowerCase()
                .includes(filters.companyName.toLowerCase());

            // An excluded record must fail at least one filter
            if (statusOk && userOk && companyOk) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
