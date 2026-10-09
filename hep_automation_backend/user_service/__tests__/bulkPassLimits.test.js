/**
 * Tests for the Bulk Pass safeguards added on top of the multi-submission flow:
 *
 *  - a cumulative budget (max batches / max people) across the whole pass,
 *  - the same person being welcome in more than one batch of a pass,
 *  - the relaxed mobile-number rule for student groups,
 *  - a returned batch resolving inside its Bulk Pass rather than alone.
 *
 * The per-batch ceiling and the validity window are covered separately in
 * bulkPassSubmissionGate.test.js.
 */

const request = require("supertest");
const express = require("express");

jest.mock("../src/models/bulkPassSchema");
jest.mock("../src/models/BulkPassParentRequest");
jest.mock("../src/models/referenceNumberSchema");
jest.mock("../src/dbconfig/db", () => ({
  pool: { query: jest.fn(), connect: jest.fn() },
}));
jest.mock("../src/services/excelParserService");
jest.mock("../src/services/photoCompressionService");
jest.mock("../src/services/photoValidationService", () => ({
  validateEmbeddedPhoto: jest.fn().mockResolvedValue({ valid: true }),
}));
jest.mock("axios");

const BulkPassSchema = require("../src/models/bulkPassSchema");
const BulkPassParentRequest = require("../src/models/BulkPassParentRequest");
const { pool } = require("../src/dbconfig/db");
const bulkPassController = require("../src/controllers/bulkPassController");

const app = express();
app.use(express.json());
app.post("/api/bulk-pass/public/:token/submit-rows", bulkPassController.submitRowsDirectly);
app.get("/api/bulk-pass/validate-token/:token", bulkPassController.validateToken);
app.get("/api/bulk-pass/public/:token/submissions", bulkPassController.getPublicSubmissions);
// Department console: switch a link off/on. Auth is mocked as the creator.
app.post(
  "/api/bulk-pass/:id/link-status",
  (req, _res, next) => { req.user = { userId: 7, role: "user" }; next(); },
  bulkPassController.setLinkActive
);

const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 30 * 86400000).toISOString();
// Every batch under a Bulk Pass carries its own dates, chosen by the applicant.
const TODAY_IST = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const BATCH_DATES = { validityFrom: TODAY_IST, validityUpto: TODAY_IST };

const row = (aadhaar, name) => ({
  name: name || `Person ${aadhaar}`,
  aadhaar,
  dob: "15/05/1990",
  mobile: "9876543210",
  photoDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
});

// "Max No. of Persons/Vehicles" on the pass are the totals for the whole pass;
// each batch is capped separately at 30 / 30.
const reusablePass = (overrides = {}) => ({
  id: 42,
  refNo: "BP/2026/00042",
  companyName: "Chennai Logistics Ltd",
  tokenActive: true,
  tokenActiveRaw: true,
  multipleSubmissionsEnabled: true,
  status: "DRAFT",
  validityFrom: PAST,
  validityUpto: FUTURE,
  noOfPersons: 100,
  noOfVehicles: 30,
  maxSubmissions: null,
  maxTotalPersons: null,
  ...overrides,
});

// Mirrors getSubmissionSummary: total* is everything ever sent, counted* is
// what the budget is charged for. Unless a test says otherwise, nothing has
// been rejected so the two agree.
const summary = (overrides = {}) => {
  const base = {
    totalSubmissions: 0,
    totalPersons: 0,
    totalVehicles: 0,
    approvedPersons: 0,
    pendingPersons: 0,
    rejectedPersons: 0,
    byStatus: {},
    lastSubmissionAt: null,
    ...overrides,
  };
  return {
    countedSubmissions: base.totalSubmissions,
    countedPersons: base.totalPersons,
    countedVehicles: base.totalVehicles,
    approvedVehicles: 0,
    pendingVehicles: 0,
    rejectedVehicles: 0,
    ...base,
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
  BulkPassParentRequest.findByToken.mockResolvedValue(null);
  // The correction payload is assembled from the batch's stored rows.
  BulkPassSchema.getPersonsByBatch.mockResolvedValue([]);
  BulkPassSchema.getChildBatches.mockResolvedValue([]);
  BulkPassSchema.getSubmissionSummary.mockResolvedValue(summary());
  BulkPassSchema.getNextSubmissionNumber.mockResolvedValue(1);
});

describe("cumulative budget across the whole Bulk Pass", () => {
  test("a pass with a large total keeps accepting batches while it lasts", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 1000 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(
      summary({ totalSubmissions: 99, totalPersons: 900 })
    );

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")] });

    // Rejected later in the pipeline for a missing Aadhaar document, never for
    // a budget — which is the point.
    expect(res.body.data?.blockReason).toBeUndefined();
  });

  test("refuses once the batch budget is spent", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ maxSubmissions: 3 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(summary({ totalSubmissions: 3 }));

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")] });

    expect(res.status).toBe(403);
    expect(res.body.data.blockReason).toBe("SUBMISSION_LIMIT_REACHED");
    expect(res.body.message).toMatch(/limit of 3 batch/i);
    expect(BulkPassSchema.createBatch).not.toHaveBeenCalled();
  });

  test("a batch larger than what is left is a 400 to trim, not a closed door", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 10 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(summary({ totalPersons: 9 }));

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012"), row("223456789012")] });

    expect(res.status).toBe(400);
    expect(res.body.data.blockReason).toBe("PERSON_LIMIT_EXCEEDS_REMAINING");
    expect(res.body.data.remaining).toBe(1);
    expect(res.body.message).toMatch(/add 1 more/);
    expect(res.body.message).toMatch(/remove 1/);
    expect(BulkPassSchema.createBatch).not.toHaveBeenCalled();
  });

  test("refuses outright once the person budget is fully used", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 10 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(summary({ totalPersons: 10 }));

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")] });

    expect(res.status).toBe(403);
    expect(res.body.data.blockReason).toBe("PERSON_LIMIT_REACHED");
    expect(BulkPassSchema.createBatch).not.toHaveBeenCalled();
  });

  test("rejected persons hand their place back to the applicant", async () => {
    // 100 permitted; 100 rows were sent but 10 of them were rejected by the
    // officer, so 90 are charged and 10 may still come through.
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 100 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(
      summary({
        totalSubmissions: 4,
        totalPersons: 100,
        countedSubmissions: 4,
        countedPersons: 90,
        approvedPersons: 70,
        pendingPersons: 20,
        rejectedPersons: 10,
      })
    );

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: Array.from({ length: 10 }, (_, i) => row(`${100000000000 + i}`)) });

    // Passes the budget; fails later on the missing Aadhaar document.
    expect(res.body.data?.blockReason).toBeUndefined();

    const seen = await request(app).get("/api/bulk-pass/validate-token/t").expect(200);
    expect(seen.body.data.canSubmit).toBe(true);
    expect(seen.body.data.remaining).toMatchObject({
      personsUsed: 90,
      personsRemaining: 10,
      personsApproved: 70,
      personsPending: 20,
      personsRejected: 10,
      personsSubmitted: 100,
    });
  });

  test("a rejected batch does not hold a batch slot", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ maxSubmissions: 3 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(
      summary({ totalSubmissions: 3, countedSubmissions: 2 })
    );

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")] });

    expect(res.body.data?.blockReason).toBeUndefined();
  });

  test("the history refresh answers with the same gate as validate-token", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ maxSubmissions: 2 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(summary({ totalSubmissions: 2 }));

    const res = await request(app).get("/api/bulk-pass/public/t/submissions").expect(200);

    expect(res.body.data.canSubmit).toBe(false);
    expect(res.body.data.blockReason).toBe("SUBMISSION_LIMIT_REACHED");
    expect(res.body.data.remaining.submissionsRemaining).toBe(0);
  });

  test("allows a batch that exactly exhausts the person budget", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 10 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(summary({ totalPersons: 9 }));

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")] });

    expect(res.body.data?.blockReason).toBeUndefined();
  });

  test("validate-token reports what is left of the budget", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(
      reusablePass({ maxSubmissions: 5, noOfPersons: 60, noOfVehicles: 8 })
    );
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(
      summary({ totalSubmissions: 2, totalPersons: 24, totalVehicles: 3 })
    );

    const res = await request(app).get("/api/bulk-pass/validate-token/t").expect(200);

    expect(res.body.data.canSubmit).toBe(true);
    expect(res.body.data.remaining).toMatchObject({
      submissionsUsed: 2,
      personsUsed: 24,
      vehiclesUsed: 3,
      submissionsRemaining: 3,
      personsRemaining: 36,
      vehiclesRemaining: 5,
      perBatchMaxPersons: 30,
      perBatchMaxVehicles: 30,
    });
    // The applicant portal reads the totals and the per-batch ceiling from here.
    expect(res.body.data.bulkPass).toMatchObject({
      maxTotalPersons: 60,
      maxTotalVehicles: 8,
      perBatchMaxPersons: 30,
      perBatchMaxVehicles: 30,
    });
  });

  test("validate-token blocks and explains once the budget is spent", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ maxSubmissions: 2 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(summary({ totalSubmissions: 2 }));

    const res = await request(app).get("/api/bulk-pass/validate-token/t").expect(200);

    expect(res.body.data.canSubmit).toBe(false);
    expect(res.body.data.blockReason).toBe("SUBMISSION_LIMIT_REACHED");
    // History stays readable even with the budget spent.
    expect(res.body.data.submissionHistory).toBeDefined();
  });
});

describe("the same person across batches", () => {
  // A reusable pass covers the same people coming back on different days —
  // a person in batch #1 may be sent again in batch #2, #3, ... without being
  // treated as a duplicate. Only the same Aadhaar twice *within* one batch is.
  test("a person already in an earlier batch is accepted again", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass());
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(
      summary({ totalSubmissions: 1, totalPersons: 1 })
    );

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012", "A Kumar")] });

    // Whatever else the pipeline says (Aadhaar document is missing here), it
    // is never a duplicate complaint.
    expect(res.body.data?.blockReason).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/already (been )?submitted/i);
    expect(BulkPassSchema.findExistingAadhaarsInBulkPass).toBeUndefined();
  });

  test("the same Aadhaar twice in one batch is still refused", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass());

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012", "A Kumar"), row("1234 5678 9012", "A Kumar again")] });

    expect(res.status).toBe(400);
    expect(res.body.data.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ index: 1, message: expect.stringMatching(/Duplicate Aadhaar/) })])
    );
    expect(BulkPassSchema.createBatch).not.toHaveBeenCalled();
  });
});

describe("mobile numbers and in-charge on a student pass", () => {
  // Rows carry a real Aadhaar document path so the only thing left to complain
  // about is the mobile number / in-charge.
  const studentRow = (aadhaar, mobile, inCharge = false) => ({
    ...row(aadhaar),
    mobile,
    inCharge,
    _keepAadhaarPath: __filename,
  });
  const studentPass = (overrides = {}) => reusablePass({ visitorType: "Students", ...overrides });
  const submit = (rows) =>
    request(app).post("/api/bulk-pass/public/t/submit-rows").send({ ...BATCH_DATES, rows });

  test("students without a mobile are fine when an in-charge has one", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(studentPass());

    const res = await submit([
      studentRow("123456789012", "9876543210", true),
      studentRow("223456789012", ""),
      studentRow("323456789012", undefined),
      studentRow("423456789012", null),
    ]);

    expect(res.body.message).not.toBe("Validation errors");
    expect(res.body.data?.blockReason).not.toBe("STUDENT_INCHARGE_REQUIRED");
    expect(JSON.stringify(res.body)).not.toMatch(/mobile/i);
  });

  test("a student batch needs at least one in-charge", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(studentPass());

    const res = await submit([studentRow("123456789012", "9876543210"), studentRow("223456789012", "")]);

    expect(res.status).toBe(400);
    expect(res.body.data.blockReason).toBe("STUDENT_INCHARGE_REQUIRED");
    expect(res.body.data.provided).toBe(0);
    expect(res.body.message).toMatch(/at least 1 in-charge/);
    expect(BulkPassSchema.createBatch).not.toHaveBeenCalled();
  });

  test("and at most two", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(studentPass());

    const res = await submit([
      studentRow("123456789012", "9876543210", true),
      studentRow("223456789012", "9876543211", true),
      studentRow("323456789012", "9876543212", true),
    ]);

    expect(res.status).toBe(400);
    expect(res.body.data.blockReason).toBe("STUDENT_INCHARGE_REQUIRED");
    expect(res.body.data.provided).toBe(3);
    expect(res.body.message).toMatch(/at most 2 in-charge/);
  });

  test("an in-charge must have a mobile", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(studentPass());

    const res = await submit([studentRow("123456789012", "", true), studentRow("223456789012", "")]);

    expect(res.status).toBe(400);
    expect(res.body.data.errors[0].message).toMatch(/Row 1: Mobile number is required for an in-charge/);
  });

  test("spaces inside a mobile are not an error", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(studentPass());

    const res = await submit([studentRow("123456789012", "98765 43210", true)]);

    expect(res.body.message).not.toBe("Validation errors");
    expect(JSON.stringify(res.body)).not.toMatch(/Invalid mobile/i);
  });

  test("a mobile that is given must still be a valid one", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(studentPass());

    const res = await submit([studentRow("123456789012", "12345"), studentRow("223456789012", "9876543210", true)]);

    expect(res.status).toBe(400);
    expect(res.body.data.errors[0].message).toMatch(/Row 1: Invalid mobile number/);
  });

  test("every other visitor type still needs a mobile per person, and has no in-charge", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ visitorType: "Vendors" }));

    const res = await submit([studentRow("123456789012", "9876543210"), studentRow("223456789012", "")]);

    expect(res.status).toBe(400);
    expect(res.body.data.errors[0].message).toMatch(/Row 2: Invalid mobile number/);
    expect(res.body.data?.blockReason).not.toBe("STUDENT_INCHARGE_REQUIRED");
  });

  test("a public-website student pass is recognised from the parent request", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(null);
    BulkPassParentRequest.findByToken.mockResolvedValue({
      id: 9,
      tracking_number: "BPR-2026-000009",
      status: "ACTIVE",
      token_active: true,
      visitor_type: "Students",
      approved_time_from: PAST,
      approved_time_upto: FUTURE,
      validity_from: PAST,
      validity_upto: FUTURE,
      no_of_persons: 50,
      no_of_vehicles: 0,
      max_submissions: null,
    });
    const res = await submit([studentRow("123456789012", ""), studentRow("223456789012", "")]);

    expect(res.status).toBe(400);
    expect(res.body.data.blockReason).toBe("STUDENT_INCHARGE_REQUIRED");
  });
});

describe("a returned batch resolves inside its Bulk Pass", () => {
  const returnedChild = {
    id: 77,
    refNo: "BP/2026/00077",
    token: "child-token",
    tokenActive: true,
    tokenActiveRaw: true,
    multipleSubmissionsEnabled: false,
    status: "RETURNED_TO_APPLICANT",
    returnReason: "Photo for row 1 is unclear",
    parent_request_id: 42,
    submission_number: 3,
    request_source: "DEPARTMENT",
    validityUpto: FUTURE,
    noOfPersons: 2,
    noOfVehicles: 0,
  };

  test("carries the pass, its validity, history and statistics", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(returnedChild);
    BulkPassSchema.getById.mockResolvedValue(reusablePass());
    BulkPassSchema.getChildBatches.mockResolvedValue([
      { id: 75, refNo: "BP/2026/00075", submissionNumber: 1, status: "COMPLETED" },
      { id: 77, refNo: "BP/2026/00077", submissionNumber: 3, status: "RETURNED_TO_APPLICANT" },
    ]);
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(
      summary({ totalSubmissions: 2, totalPersons: 8 })
    );

    const res = await request(app).get("/api/bulk-pass/validate-token/child").expect(200);

    expect(res.body.data.isRevision).toBe(true);
    expect(res.body.data.canSubmit).toBe(true);
    expect(res.body.data.revisionOf).toMatchObject({
      submissionNumber: 3,
      refNo: "BP/2026/00077",
      returnReason: "Photo for row 1 is unclear",
    });
    expect(res.body.data.bulkPass.identifier).toBe("BP/2026/00042");
    expect(res.body.data.validity.state).toBe("ACTIVE");
    expect(res.body.data.submissionHistory).toHaveLength(2);
    expect(res.body.data.submissionSummary.totalPersons).toBe(8);
  });

  test("inherits the pass's per-batch ceiling, not its own head-count", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(returnedChild);
    BulkPassSchema.getById.mockResolvedValue(reusablePass());

    const res = await request(app).get("/api/bulk-pass/validate-token/child").expect(200);

    // The batch was submitted with 2 people; correcting it may use the full 30.
    expect(res.body.data.batch.noOfPersons).toBe(30);
    expect(res.body.data.batch.noOfVehicles).toBe(30);
  });

  test("a batch that is no longer open reports why", async () => {
    BulkPassSchema.getByToken.mockResolvedValue({ ...returnedChild, status: "UNDER_REVIEW" });
    BulkPassSchema.getById.mockResolvedValue(reusablePass());

    const res = await request(app).get("/api/bulk-pass/validate-token/child").expect(200);

    expect(res.body.data.canSubmit).toBe(false);
    expect(res.body.data.blockReason).toBe("NOT_SUBMITTABLE");
    expect(res.body.data.message).toMatch(/no longer open/i);
  });

  test("a correction is charged for its new rows, not for the ones it replaces", async () => {
    // Budget 10, 10 counted of which 2 belong to this batch: the revision may
    // carry up to 2 people, and 3 is one too many.
    BulkPassSchema.getByToken.mockResolvedValue(returnedChild);
    BulkPassSchema.getById.mockResolvedValue(reusablePass({ noOfPersons: 10 }));
    BulkPassSchema.getSubmissionSummary.mockImplementation(async (_id, _src, opts = {}) =>
      opts.excludeBatchId === 77
        ? summary({ totalSubmissions: 2, totalPersons: 8 })
        : summary({ totalSubmissions: 3, totalPersons: 10 })
    );

    const tooMany = await request(app)
      .post("/api/bulk-pass/public/child/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012"), row("223456789012"), row("323456789012")] });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.data.blockReason).toBe("PERSON_LIMIT_EXCEEDS_REMAINING");
    expect(tooMany.body.data.remaining).toBe(2);

    const fits = await request(app)
      .post("/api/bulk-pass/public/child/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012"), row("223456789012")] });
    expect(fits.body.data?.blockReason).toBeUndefined();
  });

  test("a correction is refused once the Bulk Pass link is switched off", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(returnedChild);
    // getById returns the stored flag only (no tokenActiveRaw), as in production.
    BulkPassSchema.getById.mockResolvedValue(reusablePass({ tokenActive: false, tokenActiveRaw: undefined }));

    const res = await request(app)
      .post("/api/bulk-pass/public/child/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")] });

    expect(res.status).toBe(403);
    expect(res.body.data.blockReason).toBe("LINK_INACTIVE");

    const seen = await request(app).get("/api/bulk-pass/validate-token/child").expect(200);
    expect(seen.body.data.canSubmit).toBe(false);
    expect(seen.body.data.blockReason).toBe("LINK_INACTIVE");
  });

  test("a correction is refused once the Bulk Pass has expired", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(returnedChild);
    BulkPassSchema.getById.mockResolvedValue(reusablePass({ validityUpto: PAST }));

    const res = await request(app)
      .post("/api/bulk-pass/public/child/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")] });

    expect(res.status).toBe(403);
    expect(res.body.data.blockReason).toBe("EXPIRED");
  });

  test("a correction uses the pass ceiling rather than the original count", async () => {
    BulkPassSchema.getByToken.mockResolvedValue({ ...returnedChild, noOfPersons: 1 });
    BulkPassSchema.getById.mockResolvedValue(reusablePass());
    BulkPassSchema.deletePersonsByBatch.mockResolvedValue(1);

    // Three rows against a batch originally submitted with one — allowed,
    // because the Bulk Pass permits 30 per batch.
    const res = await request(app)
      .post("/api/bulk-pass/public/child/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012"), row("223456789012"), row("323456789012")] });

    expect(res.body.message).not.toMatch(/exceed the Max No. of Persons/);
  });
});

describe("per-batch ceiling", () => {
  test("a 500-person pass still takes at most 30 persons in one batch", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 500 }));

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: Array.from({ length: 31 }, (_, i) => row(`${100000000000 + i}`)) });

    expect(res.status).toBe(400);
    expect(res.body.data.blockReason).toBe("PER_BATCH_PERSON_LIMIT");
    expect(res.body.data.maxPersons).toBe(30);
  });

  test("a legacy pass with 0 persons falls back to the default rather than unlimited", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 0 }));

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: Array.from({ length: 31 }, (_, i) => row(`${100000000000 + i}`)) });

    expect(res.status).toBe(400);
    expect(res.body.data.maxPersons).toBe(30);
  });

  test("a 10-person pass sizes its batch at 10, not 30", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 10 }));

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: Array.from({ length: 11 }, (_, i) => row(`${100000000000 + i}`)) });

    expect(res.status).toBe(400);
    expect(res.body.data.blockReason).toBe("PER_BATCH_PERSON_LIMIT");
    expect(res.body.data.maxPersons).toBe(10);
  });

  test("a legacy pass keeps a larger maxTotalPersons it was issued with", async () => {
    // Issued under the older model: 30 per batch, 100 in total. Nothing shrinks.
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 30, maxTotalPersons: 100 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(summary({ totalSubmissions: 2, totalPersons: 60 }));

    const res = await request(app).get("/api/bulk-pass/validate-token/t").expect(200);
    expect(res.body.data.remaining.personsRemaining).toBe(40);
    expect(res.body.data.bulkPass.maxTotalPersons).toBe(100);
  });

  test("vehicles have their own total, and running out of them never closes the pass", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfPersons: 100, noOfVehicles: 5 }));
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(summary({ totalSubmissions: 1, totalPersons: 10, totalVehicles: 4 }));

    // Two vehicles with one left: trim, do not close.
    const tooMany = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")], vehicles: [{ regNo: "TN01AB1234" }, { regNo: "TN01AB1235" }] });
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.data.blockReason).toBe("VEHICLE_LIMIT_EXCEEDS_REMAINING");
    expect(tooMany.body.data.remaining).toBe(1);

    // Persons alone are still welcome.
    const seen = await request(app).get("/api/bulk-pass/validate-token/t").expect(200);
    expect(seen.body.data.canSubmit).toBe(true);
    expect(seen.body.data.remaining.vehiclesRemaining).toBe(1);
  });

  test("0 vehicles means no vehicles", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ noOfVehicles: 0 }));

    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")], vehicles: [{ regNo: "TN01AB1234" }] });

    expect(res.status).toBe(400);
    expect(res.body.data.blockReason).toBe("PER_BATCH_VEHICLE_LIMIT");
    expect(res.body.message).toMatch(/does not allow vehicles/);
  });
});

describe("switching a Bulk Pass link off and on", () => {
  test("the creator can deactivate a reusable link", async () => {
    BulkPassSchema.getById.mockResolvedValue(reusablePass({ createdByUserId: 7 }));
    BulkPassSchema.setTokenActive.mockResolvedValue({ id: 42, tokenActive: false, status: "DRAFT" });
    BulkPassSchema.logTransition.mockResolvedValue({});

    const res = await request(app)
      .post("/api/bulk-pass/42/link-status")
      .send({ active: false, reason: "Event cancelled" })
      .expect(200);

    expect(res.body.data.tokenActive).toBe(false);
    expect(BulkPassSchema.setTokenActive).toHaveBeenCalledWith(42, false);
    expect(BulkPassSchema.logTransition).toHaveBeenCalledWith(
      42, "DRAFT", 7, expect.stringMatching(/deactivated: Event cancelled/)
    );
  });

  test("someone else's pass cannot be switched", async () => {
    BulkPassSchema.getById.mockResolvedValue(reusablePass({ createdByUserId: 99 }));

    await request(app).post("/api/bulk-pass/42/link-status").send({ active: false }).expect(403);
    expect(BulkPassSchema.setTokenActive).not.toHaveBeenCalled();
  });

  test("an expired pass must be extended before its link comes back on", async () => {
    BulkPassSchema.getById.mockResolvedValue(
      reusablePass({ createdByUserId: 7, tokenActive: false, validityUpto: PAST })
    );

    const res = await request(app).post("/api/bulk-pass/42/link-status").send({ active: true });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/extend the validity/i);
  });

  test("a deactivated reusable link refuses new batches but keeps its history", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass({ tokenActive: false, tokenActiveRaw: false }));

    const submit = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ ...BATCH_DATES, rows: [row("123456789012")] });
    expect(submit.status).toBe(403);
    expect(submit.body.data.blockReason).toBe("LINK_INACTIVE");

    const seen = await request(app).get("/api/bulk-pass/validate-token/t").expect(200);
    expect(seen.body.data.canSubmit).toBe(false);
    expect(seen.body.data.blockReason).toBe("LINK_INACTIVE");
    expect(seen.body.data.submissionHistory).toBeDefined();
  });
});

describe("each batch carries its own validity dates", () => {
  test("a batch without dates is refused", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass());
    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ rows: [row("123456789012")] });
    expect(res.status).toBe(400);
    expect(res.body.data.blockReason).toBe("INVALID_BATCH_VALIDITY");
    expect(res.body.data.field).toBe("validityFrom");
  });

  test("a batch ending after the Bulk Pass is refused", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass());
    const tooLate = new Date(Date.parse(FUTURE) + 5 * 86400000).toISOString().slice(0, 10);
    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ validityFrom: TODAY_IST, validityUpto: tooLate, rows: [row("123456789012")] });
    expect(res.status).toBe(400);
    expect(res.body.data.blockReason).toBe("INVALID_BATCH_VALIDITY");
    expect(res.body.data.field).toBe("validityUpto");
    expect(res.body.data.bounds.min).toBe(TODAY_IST);
  });

  test("a batch starting in the past is refused", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(reusablePass());
    const yesterday = new Date(Date.now() + 330 * 60000 - 86400000).toISOString().slice(0, 10);
    const res = await request(app)
      .post("/api/bulk-pass/public/t/submit-rows")
      .send({ validityFrom: yesterday, validityUpto: TODAY_IST, rows: [row("123456789012")] });
    expect(res.status).toBe(400);
    expect(res.body.data.field).toBe("validityFrom");
  });
});
