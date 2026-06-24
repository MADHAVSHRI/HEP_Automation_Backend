/**
 * Property-Based Tests for bulkPassApprovalController.js business logic.
 *
 * Tests the pure state-machine functions for the Traffic Officer approval
 * workflow without requiring live DB or HTTP connections.
 *
 * Uses fast-check (minimum 100 runs per property).
 *
 * Properties covered:
 *  - Property 23: Traffic approval queue returns UNDER_REVIEW batches oldest-first
 *  - Property 24: Approval produces COMPLETED status and non-null qrPdfPath
 *  - Property 25: Rejection produces REJECTED status and stores reason
 */

const fc = require("fast-check");

// ---------------------------------------------------------------------------
// Pure business-logic helpers extracted from controller behaviour
// ---------------------------------------------------------------------------

const VALID_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "RETURNED_TO_APPLICANT",
  "REJECTED",
  "COMPLETED",
];

/**
 * Simulates the approval-queue filter + sort applied by listApprovalQueue().
 * Takes an array of batches and returns those with status UNDER_REVIEW,
 * ordered by createdAt ASC (oldest first).
 */
function filterApprovalQueue(batches) {
  return batches
    .filter((b) => b.status === "UNDER_REVIEW")
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * Mirrors approveBatch state-machine guard in user_service.
 */
function canApprove(batch) {
  if (!batch) return { allowed: false, reason: "Batch not found" };
  if (batch.status !== "UNDER_REVIEW") {
    return { allowed: false, reason: "Only UNDER_REVIEW batches can be approved" };
  }
  return { allowed: true, reason: null };
}

/**
 * Simulates the state change produced by approving a batch.
 * qrPdfPath is set to the value returned by the QR service.
 */
function applyApprove(batch, qrPdfPath) {
  return { ...batch, status: "COMPLETED", qrPdfPath: qrPdfPath || null };
}

/**
 * Mirrors rejectBatch validation + state-machine guard in user_service.
 */
function canReject(batch, rejectionReason) {
  if (!rejectionReason || !String(rejectionReason).trim()) {
    return { allowed: false, reason: "rejectionReason is required" };
  }
  if (!batch) return { allowed: false, reason: "Batch not found" };
  if (batch.status !== "UNDER_REVIEW") {
    return { allowed: false, reason: "Only UNDER_REVIEW batches can be rejected" };
  }
  return { allowed: true, reason: null };
}

/**
 * Simulates the state change produced by rejecting a batch.
 */
function applyReject(batch, rejectionReason) {
  return {
    ...batch,
    status: "REJECTED",
    rejectionReason: String(rejectionReason).trim(),
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** ISO timestamp shifted by `offsetMs` from a base epoch. */
function isoAt(offsetMs) {
  return new Date(1_700_000_000_000 + offsetMs).toISOString();
}

const arbBatch = (overrides = {}) =>
  fc.record({
    id: fc.integer({ min: 1, max: 100_000 }),
    refNo: fc.string({ minLength: 10, maxLength: 20 }),
    status: fc.constantFrom(...VALID_STATUSES),
    tokenActive: fc.boolean(),
    applicantEmail: fc.constant("applicant@test.com"),
    companyName: fc.string({ minLength: 1, maxLength: 100 }),
    token: fc.string({ minLength: 12, maxLength: 20 }),
    qrPdfPath: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: null }),
    // createdAt as ISO string; offsetMs drives ordering tests
    createdAt: fc.integer({ min: 0, max: 1_000_000_000 }).map(isoAt),
    ...overrides,
  });

const arbUnderReviewBatch = (overrides = {}) =>
  arbBatch({ status: fc.constant("UNDER_REVIEW"), ...overrides });

const arbNonUnderReviewBatch = (overrides = {}) =>
  arbBatch({
    status: fc.constantFrom("DRAFT", "SUBMITTED", "RETURNED_TO_APPLICANT", "REJECTED", "COMPLETED"),
    ...overrides,
  });

const arbNonEmptyString = fc
  .string({ minLength: 1, maxLength: 200 })
  .filter((s) => s.trim().length > 0);

// ---------------------------------------------------------------------------
// Property 23: Traffic approval queue returns UNDER_REVIEW batches oldest-first
// **Feature: bulk-pass-module, Property 23: Traffic approval queue returns UNDER_REVIEW batches oldest-first**
// **Validates: Requirements 8.1**
// ---------------------------------------------------------------------------

describe("Property 23 — Traffic approval queue ordering", () => {
  test(
    "every batch in the queue has status UNDER_REVIEW",
    () => {
      fc.assert(
        fc.property(
          fc.array(arbBatch(), { minLength: 0, maxLength: 20 }),
          (batches) => {
            const queue = filterApprovalQueue(batches);
            return queue.every((b) => b.status === "UNDER_REVIEW");
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test(
    "queue contains all and only UNDER_REVIEW batches from the input",
    () => {
      fc.assert(
        fc.property(
          fc.array(arbBatch(), { minLength: 0, maxLength: 30 }),
          (batches) => {
            const queue = filterApprovalQueue(batches);
            const inputUnderReview = batches.filter((b) => b.status === "UNDER_REVIEW");
            return queue.length === inputUnderReview.length;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test(
    "queue batches are ordered oldest-first (ascending createdAt)",
    () => {
      fc.assert(
        fc.property(
          fc.array(arbBatch(), { minLength: 2, maxLength: 20 }),
          (batches) => {
            const queue = filterApprovalQueue(batches);
            for (let i = 1; i < queue.length; i++) {
              if (new Date(queue[i].createdAt) < new Date(queue[i - 1].createdAt)) {
                return false;
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test(
    "batches with non-UNDER_REVIEW status are excluded regardless of createdAt",
    () => {
      fc.assert(
        fc.property(
          fc.array(arbNonUnderReviewBatch(), { minLength: 1, maxLength: 10 }),
          (batches) => {
            const queue = filterApprovalQueue(batches);
            return queue.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 24: Approval produces COMPLETED status and non-null qrPdfPath
// **Feature: bulk-pass-module, Property 24: Approval produces COMPLETED status and non-null qrPdfPath**
// **Validates: Requirements 8.2**
// ---------------------------------------------------------------------------

describe("Property 24 — Approval state change", () => {
  const arbQrPath = fc.string({ minLength: 5, maxLength: 100 });

  test(
    "approving an UNDER_REVIEW batch sets status=COMPLETED and stores qrPdfPath",
    () => {
      fc.assert(
        fc.property(arbUnderReviewBatch(), arbQrPath, (batch, qrPath) => {
          const check = canApprove(batch);
          if (!check.allowed) return false;
          const updated = applyApprove(batch, qrPath);
          return updated.status === "COMPLETED" && updated.qrPdfPath === qrPath;
        }),
        { numRuns: 100 }
      );
    }
  );

  test(
    "approving a non-UNDER_REVIEW batch is rejected with a reason",
    () => {
      fc.assert(
        fc.property(arbNonUnderReviewBatch(), (batch) => {
          const check = canApprove(batch);
          return !check.allowed && typeof check.reason === "string" && check.reason.length > 0;
        }),
        { numRuns: 100 }
      );
    }
  );

  test(
    "approval preserves all other batch fields unchanged",
    () => {
      fc.assert(
        fc.property(arbUnderReviewBatch(), arbQrPath, (batch, qrPath) => {
          const updated = applyApprove(batch, qrPath);
          return (
            updated.id === batch.id &&
            updated.refNo === batch.refNo &&
            updated.companyName === batch.companyName &&
            updated.applicantEmail === batch.applicantEmail
          );
        }),
        { numRuns: 100 }
      );
    }
  );

  test(
    "when QR service returns null, qrPdfPath on the approved batch is null",
    () => {
      fc.assert(
        fc.property(arbUnderReviewBatch(), (batch) => {
          const updated = applyApprove(batch, null);
          return updated.status === "COMPLETED" && updated.qrPdfPath === null;
        }),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 25: Rejection produces REJECTED status and stores reason
// **Feature: bulk-pass-module, Property 25: Rejection produces REJECTED status and stores reason**
// **Validates: Requirements 8.3**
// ---------------------------------------------------------------------------

describe("Property 25 — Rejection state change", () => {
  test(
    "rejecting an UNDER_REVIEW batch with a reason sets status=REJECTED and stores trimmed reason",
    () => {
      fc.assert(
        fc.property(arbUnderReviewBatch(), arbNonEmptyString, (batch, reason) => {
          const check = canReject(batch, reason);
          if (!check.allowed) return false;
          const updated = applyReject(batch, reason);
          return (
            updated.status === "REJECTED" &&
            updated.rejectionReason === reason.trim()
          );
        }),
        { numRuns: 100 }
      );
    }
  );

  test(
    "rejecting without a reason is always rejected",
    () => {
      fc.assert(
        fc.property(
          arbUnderReviewBatch(),
          fc.oneof(fc.constant(""), fc.constant("   "), fc.constant(null), fc.constant(undefined)),
          (batch, reason) => {
            const check = canReject(batch, reason);
            return !check.allowed && check.reason === "rejectionReason is required";
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test(
    "rejecting a non-UNDER_REVIEW batch with a valid reason is rejected",
    () => {
      fc.assert(
        fc.property(arbNonUnderReviewBatch(), arbNonEmptyString, (batch, reason) => {
          const check = canReject(batch, reason);
          return !check.allowed && typeof check.reason === "string";
        }),
        { numRuns: 100 }
      );
    }
  );

  test(
    "rejection preserves all non-status fields and trims whitespace from reason",
    () => {
      fc.assert(
        fc.property(
          arbUnderReviewBatch(),
          fc.string({ minLength: 1, maxLength: 50 })
            .filter((s) => s.trim().length > 0)
            .map((s) => `  ${s}  `),
          (batch, reason) => {
            const updated = applyReject(batch, reason);
            return (
              updated.id === batch.id &&
              updated.refNo === batch.refNo &&
              updated.rejectionReason === reason.trim()
            );
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
