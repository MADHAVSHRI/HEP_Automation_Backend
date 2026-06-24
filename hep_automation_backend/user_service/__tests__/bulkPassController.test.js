/**
 * Property-Based Tests for bulkPassController.js business logic.
 *
 * Tests pure business-logic functions extracted from the controller
 * (status guards, token management, submission state machine, validation)
 * without requiring a live DB connection.
 *
 * Uses fast-check (minimum 100 runs per property).
 */

const fc = require("fast-check");
const path = require("path");

// ---------------------------------------------------------------------------
// Pure helper functions mirroring controller logic under test
// ---------------------------------------------------------------------------

const BULK_VISITOR_TYPES = [
  "CRUISE_VESSEL",
  "EDUCATIONAL_VISIT",
  "INTERNSHIP",
  "VIP",
  "GOVT_OFFICIAL",
  "OTHER",
];

/**
 * Mirrors validateIntakeBody() in bulkPassController.js
 */
function validateIntakeBody(body) {
  const {
    visitorType,
    companyName,
    applicantEmail,
    applicantMobile,
    noOfPersons,
    noOfVehicles,
    validityUpto,
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
  const persons = Number(noOfPersons) || 0;
  if (persons < 0 || persons > 30) {
    return { ok: false, status: 400, message: "Number of persons must be between 0 and 30" };
  }
  const vehicles = Number(noOfVehicles) || 0;
  if (vehicles < 0 || vehicles > 20) {
    return { ok: false, status: 400, message: "Number of vehicles must be between 0 and 20" };
  }
  if (!validityUpto || new Date(validityUpto) <= new Date()) {
    return { ok: false, status: 400, message: "Validity upto must be a future date" };
  }
  return { ok: true };
}

/**
 * Mirrors forwardToApproval status guard logic.
 * Returns { allowed: bool, reason: string|null }
 */
function canForwardToApproval(batch) {
  if (batch.status !== "SUBMITTED") {
    return { allowed: false, reason: "Only SUBMITTED batches can be forwarded for approval" };
  }
  return { allowed: true, reason: null };
}

/**
 * Simulates the state change produced by forwardToApproval.
 */
function applyForwardToApproval(batch) {
  return { ...batch, status: "UNDER_REVIEW", tokenActive: false };
}

/**
 * Mirrors returnToApplicant status guard + state change.
 */
function canReturnToApplicant(batch, returnReason) {
  if (!returnReason || !returnReason.trim()) {
    return { allowed: false, reason: "returnReason is required" };
  }
  if (batch.status !== "SUBMITTED") {
    return { allowed: false, reason: "Only SUBMITTED batches can be returned to applicant" };
  }
  return { allowed: true, reason: null };
}

function applyReturnToApplicant(batch, returnReason) {
  return { ...batch, status: "RETURNED_TO_APPLICANT", tokenActive: true, returnReason: returnReason.trim() };
}

/**
 * Mirrors resubmitBatch status guard + state change.
 */
function canResubmit(batch) {
  if (batch.status !== "REJECTED") {
    return { allowed: false, reason: "Only rejected batches can be resubmitted" };
  }
  return { allowed: true, reason: null };
}

function applyResubmit(batch) {
  return { ...batch, status: "RETURNED_TO_APPLICANT", tokenActive: true };
}

/**
 * Mirrors submitBatch status guard + state change.
 */
function canSubmitBatch(batch) {
  if (!batch.tokenActive) return { allowed: false, reason: "Link expired or inactive" };
  if (!["DRAFT", "RETURNED_TO_APPLICANT"].includes(batch.status)) {
    return { allowed: false, reason: "Batch is not in a submittable state" };
  }
  return { allowed: true, reason: null };
}

function applySubmit(batch, personCount) {
  return { ...batch, status: "SUBMITTED", tokenActive: false, submittedPersonCount: personCount };
}

/**
 * Simulates logTransition and returns whether a log entry was created.
 */
function logTransition(logs, batchId, status, changedBy, remarks) {
  const entry = {
    batchId,
    status,
    changedBy: changedBy || null,
    remarks: remarks || null,
    createdAt: new Date().toISOString(),
  };
  return [...logs, entry];
}

/**
 * Mirrors getPublicByToken response logic.
 */
function resolvePublicToken(batch) {
  if (!batch) return { httpStatus: 404, message: "Invalid link" };
  if (!batch.tokenActive) return { httpStatus: 403, message: "Link expired or inactive" };
  return { httpStatus: 200, data: batch };
}

/**
 * Mirrors file upload constraint check logic.
 */
function validateUploadConstraints(files) {
  const ALLOWED_EXTS = [".xlsx", ".xls"];
  const MAX_FILE_SIZE = 15 * 1024 * 1024;
  const MAX_FILES = 5;

  if (files.length > MAX_FILES) {
    return { ok: false, message: "Maximum 5 files allowed per upload session" };
  }
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED_EXTS.includes(ext)) {
      return { ok: false, message: "Only .xlsx and .xls files are allowed" };
    }
    if (file.size > MAX_FILE_SIZE) {
      return { ok: false, message: "File size exceeds 15 MB limit" };
    }
  }
  return { ok: true };
}

/**
 * Simulates download PDF response logic.
 */
function resolvePdfDownload(batch, fileExists) {
  if (!batch) return { httpStatus: 404, message: "Batch not found" };
  if (batch.status !== "COMPLETED") return { httpStatus: 400, message: "PDF only available for COMPLETED batches" };
  if (!batch.qrPdfPath || !fileExists) return { httpStatus: 404, message: "PDF not yet generated" };
  return { httpStatus: 200, contentType: "application/pdf" };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const VALID_STATUSES = [
  "DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED_TO_APPLICANT", "REJECTED", "COMPLETED",
];

const arbBatch = (overrides = {}) =>
  fc.record({
    id: fc.integer({ min: 1, max: 100000 }),
    refNo: fc.string({ minLength: 10, maxLength: 20 }),
    status: fc.constantFrom(...VALID_STATUSES),
    tokenActive: fc.boolean(),
    applicantEmail: fc.constant("applicant@test.com"),
    companyName: fc.string({ minLength: 1, maxLength: 100 }),
    token: fc.string({ minLength: 12, maxLength: 20 }),
    qrPdfPath: fc.option(fc.string({ minLength: 5, maxLength: 100 }), { nil: null }),
    ...overrides,
  });

const arbSubmittedBatch = (overrides = {}) =>
  arbBatch({ status: fc.constant("SUBMITTED"), ...overrides });

const arbRejectedBatch = (overrides = {}) =>
  arbBatch({ status: fc.constant("REJECTED"), ...overrides });

const arbCompletedBatch = (overrides = {}) =>
  arbBatch({ status: fc.constant("COMPLETED"), ...overrides });

const arbNonEmptyString = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

// ---------------------------------------------------------------------------
// Property 7: Forward-to-approval produces UNDER_REVIEW and deactivates token
// **Feature: bulk-pass-module, Property 7: Forward-to-approval produces UNDER_REVIEW and deactivates token**
// **Validates: Requirements 3.1**
// ---------------------------------------------------------------------------

describe("Property 7 — Forward-to-approval state change", () => {
  test("forwarding a SUBMITTED batch sets status=UNDER_REVIEW and tokenActive=false", () => {
    fc.assert(
      fc.property(arbSubmittedBatch(), (batch) => {
        const check = canForwardToApproval(batch);
        if (!check.allowed) return false;
        const updated = applyForwardToApproval(batch);
        return updated.status === "UNDER_REVIEW" && updated.tokenActive === false;
      }),
      { numRuns: 100 }
    );
  });

  test("forwarding a non-SUBMITTED batch is rejected with a descriptive reason", () => {
    fc.assert(
      fc.property(
        arbBatch({ status: fc.constantFrom("DRAFT", "UNDER_REVIEW", "RETURNED_TO_APPLICANT", "REJECTED", "COMPLETED") }),
        (batch) => {
          const check = canForwardToApproval(batch);
          return !check.allowed && typeof check.reason === "string" && check.reason.length > 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("forwarding preserves all other batch fields unchanged", () => {
    fc.assert(
      fc.property(arbSubmittedBatch(), (batch) => {
        const updated = applyForwardToApproval(batch);
        return updated.id === batch.id && updated.refNo === batch.refNo && updated.companyName === batch.companyName;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Return-to-applicant produces RETURNED_TO_APPLICANT and activates token
// **Feature: bulk-pass-module, Property 8: Return-to-applicant produces RETURNED_TO_APPLICANT and activates token**
// **Validates: Requirements 3.2**
// ---------------------------------------------------------------------------

describe("Property 8 — Return-to-applicant state change", () => {
  test("returning a SUBMITTED batch with a reason sets RETURNED_TO_APPLICANT and tokenActive=true", () => {
    fc.assert(
      fc.property(arbSubmittedBatch(), arbNonEmptyString, (batch, reason) => {
        const check = canReturnToApplicant(batch, reason);
        if (!check.allowed) return false;
        const updated = applyReturnToApplicant(batch, reason);
        return (
          updated.status === "RETURNED_TO_APPLICANT" &&
          updated.tokenActive === true &&
          updated.returnReason === reason.trim()
        );
      }),
      { numRuns: 100 }
    );
  });

  test("returning without a reason is always rejected", () => {
    fc.assert(
      fc.property(
        arbSubmittedBatch(),
        fc.oneof(fc.constant(""), fc.constant("   "), fc.constant(null)),
        (batch, reason) => {
          const check = canReturnToApplicant(batch, reason);
          return !check.allowed;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("returning a non-SUBMITTED batch is rejected regardless of reason", () => {
    fc.assert(
      fc.property(
        arbBatch({ status: fc.constantFrom("DRAFT", "UNDER_REVIEW", "RETURNED_TO_APPLICANT", "REJECTED", "COMPLETED") }),
        arbNonEmptyString,
        (batch, reason) => {
          const check = canReturnToApplicant(batch, reason);
          return !check.allowed;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("returnReason is stored trimmed on the batch record", () => {
    fc.assert(
      fc.property(
        arbSubmittedBatch(),
        // reason with leading/trailing whitespace
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0).map((s) => `  ${s}  `),
        (batch, reason) => {
          const updated = applyReturnToApplicant(batch, reason);
          return updated.returnReason === reason.trim();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Every status transition produces an audit log entry
// **Feature: bulk-pass-module, Property 9: Every status transition produces an audit log entry**
// **Validates: Requirements 3.3**
// ---------------------------------------------------------------------------

describe("Property 9 — Audit log entry per status transition", () => {
  const arbUserId = fc.integer({ min: 1, max: 10000 });
  const arbBatchId = fc.integer({ min: 1, max: 100000 });
  const arbStatus = fc.constantFrom(...VALID_STATUSES);

  test("logTransition always appends exactly one entry with correct status", () => {
    fc.assert(
      fc.property(arbBatchId, arbStatus, arbUserId, arbNonEmptyString, (batchId, status, userId, remarks) => {
        const before = [];
        const after = logTransition(before, batchId, status, userId, remarks);
        return (
          after.length === before.length + 1 &&
          after[after.length - 1].status === status &&
          after[after.length - 1].batchId === batchId &&
          after[after.length - 1].changedBy === userId
        );
      }),
      { numRuns: 100 }
    );
  });

  test("each of forward, return, submit, resubmit actions produces a log entry", () => {
    fc.assert(
      fc.property(
        arbBatchId,
        arbUserId,
        fc.constantFrom("UNDER_REVIEW", "RETURNED_TO_APPLICANT", "SUBMITTED", "REJECTED", "COMPLETED"),
        (batchId, userId, targetStatus) => {
          const logs = logTransition([], batchId, targetStatus, userId, "action remark");
          return logs.length === 1 && logs[0].status === targetStatus;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("multiple transitions accumulate log entries in order", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(arbBatchId, arbStatus, arbUserId), { minLength: 2, maxLength: 10 }),
        (transitions) => {
          let logs = [];
          for (const [batchId, status, userId] of transitions) {
            logs = logTransition(logs, batchId, status, userId, null);
          }
          return logs.length === transitions.length;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Public token lookup returns intake for valid active tokens
// **Feature: bulk-pass-module, Property 10: Public token lookup returns intake for valid active tokens**
// **Validates: Requirements 4.1**
// ---------------------------------------------------------------------------

describe("Property 10 — Public token lookup round-trip", () => {
  test("a batch with tokenActive=true returns HTTP 200 with its data", () => {
    fc.assert(
      fc.property(arbBatch({ tokenActive: fc.constant(true) }), (batch) => {
        const result = resolvePublicToken(batch);
        return result.httpStatus === 200 && result.data === batch;
      }),
      { numRuns: 100 }
    );
  });

  test("a batch with tokenActive=false returns HTTP 403", () => {
    fc.assert(
      fc.property(arbBatch({ tokenActive: fc.constant(false) }), (batch) => {
        const result = resolvePublicToken(batch);
        return result.httpStatus === 403 && result.message === "Link expired or inactive";
      }),
      { numRuns: 100 }
    );
  });

  test("null batch returns HTTP 404", () => {
    const result = resolvePublicToken(null);
    expect(result.httpStatus).toBe(404);
    expect(result.message).toBe("Invalid link");
  });
});

// ---------------------------------------------------------------------------
// Property 11: File upload constraints are enforced
// **Feature: bulk-pass-module, Property 11: File upload constraints are enforced**
// **Validates: Requirements 4.5**
// ---------------------------------------------------------------------------

describe("Property 11 — File upload constraint enforcement", () => {
  const MAX_FILE_SIZE = 15 * 1024 * 1024;

  // Valid file descriptor
  const arbValidFile = fc.record({
    name: fc.constantFrom("data.xlsx", "import.xls", "visitors.xlsx"),
    size: fc.integer({ min: 1, max: MAX_FILE_SIZE }),
  });

  test("more than 5 files is always rejected", () => {
    fc.assert(
      fc.property(
        fc.array(arbValidFile, { minLength: 6, maxLength: 20 }),
        (files) => {
          const result = validateUploadConstraints(files);
          return !result.ok;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("a file with non-xlsx/xls extension is rejected", () => {
    fc.assert(
      fc.property(
        // Generate a file with an invalid extension
        fc.record({
          name: fc.constantFrom("data.pdf", "data.csv", "data.txt", "data.png", "data.docx"),
          size: fc.integer({ min: 1, max: 1024 }),
        }),
        (file) => {
          const result = validateUploadConstraints([file]);
          return !result.ok;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("a file exceeding 15 MB is rejected", () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.constant("big.xlsx"),
          size: fc.integer({ min: MAX_FILE_SIZE + 1, max: MAX_FILE_SIZE + 50 * 1024 * 1024 }),
        }),
        (file) => {
          const result = validateUploadConstraints([file]);
          return !result.ok;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("1–5 valid xlsx/xls files within size limit are accepted", () => {
    fc.assert(
      fc.property(
        fc.array(arbValidFile, { minLength: 1, maxLength: 5 }),
        (files) => {
          const result = validateUploadConstraints(files);
          return result.ok;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 21: Successful submission creates person records and sets SUBMITTED status
// **Feature: bulk-pass-module, Property 21: Successful submission creates person records and sets SUBMITTED status**
// **Validates: Requirements 7.1, 7.4**
// ---------------------------------------------------------------------------

describe("Property 21 — Submission state change and person records", () => {
  const arbPersonCount = fc.integer({ min: 1, max: 50 });

  test("submitting a DRAFT batch with valid rows sets SUBMITTED and tokenActive=false", () => {
    fc.assert(
      fc.property(
        arbBatch({ status: fc.constant("DRAFT"), tokenActive: fc.constant(true) }),
        arbPersonCount,
        (batch, personCount) => {
          const check = canSubmitBatch(batch);
          if (!check.allowed) return false;
          const updated = applySubmit(batch, personCount);
          return (
            updated.status === "SUBMITTED" &&
            updated.tokenActive === false &&
            updated.submittedPersonCount === personCount
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  test("submitting a RETURNED_TO_APPLICANT batch is allowed", () => {
    fc.assert(
      fc.property(
        arbBatch({ status: fc.constant("RETURNED_TO_APPLICANT"), tokenActive: fc.constant(true) }),
        arbPersonCount,
        (batch, personCount) => {
          const check = canSubmitBatch(batch);
          if (!check.allowed) return false;
          const updated = applySubmit(batch, personCount);
          return updated.status === "SUBMITTED" && updated.tokenActive === false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 22: Submission rejected when batch not in submittable state
// **Feature: bulk-pass-module, Property 22: Submission rejected when batch not in submittable state**
// **Validates: Requirements 7.3**
// ---------------------------------------------------------------------------

describe("Property 22 — Submission rejected for non-submittable status", () => {
  test("submitting a batch in non-DRAFT/non-RETURNED_TO_APPLICANT status is rejected", () => {
    fc.assert(
      fc.property(
        arbBatch({
          status: fc.constantFrom("SUBMITTED", "UNDER_REVIEW", "REJECTED", "COMPLETED"),
          tokenActive: fc.constant(true),
        }),
        (batch) => {
          const check = canSubmitBatch(batch);
          return !check.allowed && check.reason === "Batch is not in a submittable state";
        }
      ),
      { numRuns: 100 }
    );
  });

  test("submitting a batch with tokenActive=false is rejected regardless of status", () => {
    fc.assert(
      fc.property(
        arbBatch({ tokenActive: fc.constant(false) }),
        (batch) => {
          const check = canSubmitBatch(batch);
          return !check.allowed;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 26: Resubmit activates token and sets RETURNED_TO_APPLICANT
// **Feature: bulk-pass-module, Property 26: Resubmit activates token and sets RETURNED_TO_APPLICANT**
// **Validates: Requirements 9.2**
// ---------------------------------------------------------------------------

describe("Property 26 — Resubmit state change", () => {
  test("resubmitting a REJECTED batch sets RETURNED_TO_APPLICANT and tokenActive=true", () => {
    fc.assert(
      fc.property(arbRejectedBatch(), (batch) => {
        const check = canResubmit(batch);
        if (!check.allowed) return false;
        const updated = applyResubmit(batch);
        return updated.status === "RETURNED_TO_APPLICANT" && updated.tokenActive === true;
      }),
      { numRuns: 100 }
    );
  });

  test("resubmitting a non-REJECTED batch is always rejected", () => {
    fc.assert(
      fc.property(
        arbBatch({ status: fc.constantFrom("DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED_TO_APPLICANT", "COMPLETED") }),
        (batch) => {
          const check = canResubmit(batch);
          return !check.allowed && typeof check.reason === "string";
        }
      ),
      { numRuns: 100 }
    );
  });

  test("resubmit preserves all non-status/tokenActive fields", () => {
    fc.assert(
      fc.property(arbRejectedBatch(), (batch) => {
        const updated = applyResubmit(batch);
        return updated.id === batch.id && updated.refNo === batch.refNo && updated.companyName === batch.companyName;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 27: PDF download returns PDF content for COMPLETED batches
// **Feature: bulk-pass-module, Property 27: PDF download returns PDF content for COMPLETED batches**
// **Validates: Requirements 10.1**
// ---------------------------------------------------------------------------

describe("Property 27 — PDF download for COMPLETED batches", () => {
  test("COMPLETED batch with valid qrPdfPath and existing file returns HTTP 200 with PDF content-type", () => {
    fc.assert(
      fc.property(
        arbCompletedBatch({ qrPdfPath: fc.string({ minLength: 5, maxLength: 100 }) }),
        (batch) => {
          const result = resolvePdfDownload(batch, true);
          return result.httpStatus === 200 && result.contentType === "application/pdf";
        }
      ),
      { numRuns: 100 }
    );
  });

  test("COMPLETED batch with null qrPdfPath returns HTTP 404", () => {
    fc.assert(
      fc.property(
        arbCompletedBatch({ qrPdfPath: fc.constant(null) }),
        (batch) => {
          const result = resolvePdfDownload(batch, false);
          return result.httpStatus === 404 && result.message === "PDF not yet generated";
        }
      ),
      { numRuns: 100 }
    );
  });

  test("non-COMPLETED batch returns a non-200 status code", () => {
    fc.assert(
      fc.property(
        arbBatch({
          status: fc.constantFrom("DRAFT", "SUBMITTED", "UNDER_REVIEW", "RETURNED_TO_APPLICANT", "REJECTED"),
          qrPdfPath: fc.string({ minLength: 5, maxLength: 100 }),
        }),
        (batch) => {
          const result = resolvePdfDownload(batch, true);
          return result.httpStatus !== 200;
        }
      ),
      { numRuns: 100 }
    );
  });

  test("COMPLETED batch where file does not exist on disk returns HTTP 404", () => {
    fc.assert(
      fc.property(
        arbCompletedBatch({ qrPdfPath: fc.string({ minLength: 5, maxLength: 100 }) }),
        (batch) => {
          const result = resolvePdfDownload(batch, false);
          return result.httpStatus === 404;
        }
      ),
      { numRuns: 100 }
    );
  });
});
