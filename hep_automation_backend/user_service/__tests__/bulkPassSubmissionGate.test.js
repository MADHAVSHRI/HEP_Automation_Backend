/**
 * Tests the submission gate on the live applicant path
 * (POST /api/bulk-pass/public/:token/submit-rows).
 *
 * The central product rule: one Bulk Pass link keeps accepting batches for as
 * long as its validity window is open, and stops the moment it closes. The
 * legacy one-shot behaviour must survive untouched for single-submission links.
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

const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 30 * 86400000).toISOString();
// Every batch under a Bulk Pass carries its own dates, chosen by the applicant.
const TODAY_IST = new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const BATCH_DATES = { validityFrom: TODAY_IST, validityUpto: TODAY_IST };

// A row that would pass validation, so the request reaches the gate rather
// than being turned away for bad data.
const validRow = () => ({
  name: "A Kumar",
  aadhaar: "123456789012",
  dob: "15/05/1990",
  mobile: "9876543210",
  photoDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
});

beforeEach(() => {
  jest.clearAllMocks();
  pool.query.mockResolvedValue({ rows: [] });
  BulkPassParentRequest.findByToken.mockResolvedValue(null);
});

describe("reusable bulk pass — validity governs submissions", () => {
  test("refuses a new batch once the validity window has closed", async () => {
    BulkPassSchema.getByToken.mockResolvedValue({
      id: 42,
      refNo: "BP/2026/00042",
      tokenActive: false,     // cleared by getByToken when the window elapsed
      tokenActiveRaw: true,   // never revoked by a person
      multipleSubmissionsEnabled: true,
      status: "DRAFT",
      validityFrom: PAST,
      validityUpto: PAST,
      noOfPersons: 30,
      noOfVehicles: 30,
    });

    const res = await request(app)
      .post("/api/bulk-pass/public/parent-token/submit-rows")
      .send({ ...BATCH_DATES, rows: [validRow()] });

    expect(res.status).toBe(403);
    expect(res.body.data.blockReason).toBe("EXPIRED");
    expect(res.body.message).toMatch(/expired/i);
    // Nothing was written.
    expect(BulkPassSchema.createBatch).not.toHaveBeenCalled();
    expect(BulkPassSchema.insertPersons).not.toHaveBeenCalled();
  });

  test("refuses a new batch before the window opens", async () => {
    BulkPassSchema.getByToken.mockResolvedValue({
      id: 42,
      tokenActive: true,
      tokenActiveRaw: true,
      multipleSubmissionsEnabled: true,
      status: "DRAFT",
      validityFrom: FUTURE,
      validityUpto: new Date(Date.now() + 60 * 86400000).toISOString(),
      noOfPersons: 30,
      noOfVehicles: 30,
    });

    const res = await request(app)
      .post("/api/bulk-pass/public/parent-token/submit-rows")
      .send({ ...BATCH_DATES, rows: [validRow()] });

    expect(res.status).toBe(403);
    expect(res.body.data.blockReason).toBe("NOT_STARTED");
    expect(BulkPassSchema.createBatch).not.toHaveBeenCalled();
  });

  test("refuses a new batch when the link has been deactivated inside a live window", async () => {
    BulkPassSchema.getByToken.mockResolvedValue({
      id: 42,
      tokenActive: false,
      tokenActiveRaw: false,  // deliberately revoked
      multipleSubmissionsEnabled: true,
      status: "DRAFT",
      validityFrom: PAST,
      validityUpto: FUTURE,
      noOfPersons: 30,
      noOfVehicles: 30,
    });

    const res = await request(app)
      .post("/api/bulk-pass/public/parent-token/submit-rows")
      .send({ ...BATCH_DATES, rows: [validRow()] });

    expect(res.status).toBe(403);
    expect(res.body.data.blockReason).toBe("LINK_INACTIVE");
  });

  test("a pass whose total is below the per-batch ceiling sizes the batch at that total", async () => {
    BulkPassSchema.getByToken.mockResolvedValue({
      id: 42,
      tokenActive: true,
      tokenActiveRaw: true,
      multipleSubmissionsEnabled: true,
      status: "DRAFT",
      validityFrom: PAST,
      validityUpto: FUTURE,
      noOfPersons: 2,
      noOfVehicles: 30,
    });

    const res = await request(app)
      .post("/api/bulk-pass/public/parent-token/submit-rows")
      .send({ ...BATCH_DATES, rows: [validRow(), validRow(), validRow()] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/exceed the 2 allowed in one batch/);
  });

  test("a batch inside a reusable pass does not have to be in DRAFT state", async () => {
    // A parent batch that has already received submissions keeps its own status;
    // the old single-submission state check must not apply to it.
    BulkPassSchema.getByToken.mockResolvedValue({
      id: 42,
      tokenActive: true,
      tokenActiveRaw: true,
      multipleSubmissionsEnabled: true,
      status: "UNDER_REVIEW",
      validityFrom: PAST,
      validityUpto: FUTURE,
      noOfPersons: 30,
      noOfVehicles: 30,
    });

    const res = await request(app)
      .post("/api/bulk-pass/public/parent-token/submit-rows")
      .send({ ...BATCH_DATES, rows: [] });

    // Rejected for having no rows — not for the parent's status.
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rows array is required/i);
  });
});

describe("single-submission link — unchanged behaviour", () => {
  test("still refuses once the one-shot token is consumed", async () => {
    BulkPassSchema.getByToken.mockResolvedValue({
      id: 7,
      tokenActive: false,
      tokenActiveRaw: false,
      multipleSubmissionsEnabled: false,
      status: "UNDER_REVIEW",
      validityUpto: FUTURE,
      noOfPersons: 30,
      noOfVehicles: 30,
    });

    const res = await request(app)
      .post("/api/bulk-pass/public/single-token/submit-rows")
      .send({ ...BATCH_DATES, rows: [validRow()] });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Link expired or inactive/i);
  });

  test("still refuses when the batch is not in a submittable state", async () => {
    BulkPassSchema.getByToken.mockResolvedValue({
      id: 7,
      tokenActive: true,
      tokenActiveRaw: true,
      multipleSubmissionsEnabled: false,
      status: "COMPLETED",
      validityUpto: FUTURE,
      noOfPersons: 30,
      noOfVehicles: 30,
    });

    const res = await request(app)
      .post("/api/bulk-pass/public/single-token/submit-rows")
      .send({ ...BATCH_DATES, rows: [validRow()] });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/not in a submittable state/i);
  });
});

describe("public website bulk pass", () => {
  test("refuses a new batch once the approved window has closed", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(null);
    BulkPassParentRequest.findByToken.mockResolvedValue({
      id: 77,
      tracking_number: "TEMP-77",
      company_name: "Port Services Pvt Ltd",
      status: "ACTIVE",
      token_active: true,
      approved_time_from: PAST,
      approved_time_upto: PAST,
      no_of_persons: 30,
      no_of_vehicles: 30,
    });

    const res = await request(app)
      .post("/api/bulk-pass/public/public-token/submit-rows")
      .send({ ...BATCH_DATES, rows: [validRow()] });

    expect(res.status).toBe(403);
    expect(res.body.data.blockReason).toBe("EXPIRED");
    expect(BulkPassSchema.createBatch).not.toHaveBeenCalled();
  });
});
