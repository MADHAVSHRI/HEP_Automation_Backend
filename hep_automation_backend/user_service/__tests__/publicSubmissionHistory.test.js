/**
 * Tests for the applicant-facing Bulk Pass submission history endpoints.
 *
 *   GET /api/bulk-pass/public/:token/submissions
 *   GET /api/bulk-pass/public/:token/submissions/:submissionId
 *
 * These are what make a Bulk Pass feel like one continuous workflow: the
 * applicant can see every batch they have sent through the link, and open any
 * of them, for as long as the record exists.
 */

const request = require("supertest");
const express = require("express");

jest.mock("../src/models/bulkPassSchema");
jest.mock("../src/models/BulkPassParentRequest");
jest.mock("../src/dbconfig/db", () => ({ pool: { query: jest.fn(), connect: jest.fn() } }));

const BulkPassSchema = require("../src/models/bulkPassSchema");
const BulkPassParentRequest = require("../src/models/BulkPassParentRequest");
const bulkPassController = require("../src/controllers/bulkPassController");

const app = express();
app.use(express.json());
app.get("/api/bulk-pass/public/:token/submissions", bulkPassController.getPublicSubmissions);
app.get("/api/bulk-pass/public/:token/submissions/:submissionId", bulkPassController.getPublicSubmissionDetail);

const FUTURE = new Date(Date.now() + 30 * 86400000).toISOString();
const PAST = new Date(Date.now() - 30 * 86400000).toISOString();

const parentBatch = (overrides = {}) => ({
  id: 42,
  refNo: "BP/2026/00042",
  token: "parent-token",
  tokenActive: true,
  tokenActiveRaw: true,
  multipleSubmissionsEnabled: true,
  companyName: "Chennai Logistics Ltd",
  // Totals for the whole pass — large enough that the 45 persons already
  // submitted in these fixtures leave room for more.
  noOfPersons: 100,
  noOfVehicles: 30,
  validityFrom: PAST,
  validityUpto: FUTURE,
  status: "DRAFT",
  ...overrides,
});

const SUMMARY = {
  totalSubmissions: 3,
  totalPersons: 45,
  totalVehicles: 8,
  byStatus: { underReview: 1, completed: 2, rejected: 0, returned: 0 },
  lastSubmissionAt: "2026-09-01T09:00:00Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  BulkPassParentRequest.findByToken.mockResolvedValue(null);
});

describe("GET /public/:token/submissions", () => {
  test("returns the history and aggregate statistics for a reusable bulk pass", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(parentBatch());
    BulkPassSchema.getChildBatches.mockResolvedValue([
      { id: 1, refNo: "BP/2026/00050", submissionNumber: 1, personsCount: 20, vehiclesCount: 4, status: "COMPLETED" },
      { id: 2, refNo: "BP/2026/00051", submissionNumber: 2, personsCount: 15, vehiclesCount: 3, status: "COMPLETED" },
      { id: 3, refNo: "BP/2026/00052", submissionNumber: 3, personsCount: 10, vehiclesCount: 1, status: "UNDER_REVIEW" },
    ]);
    BulkPassSchema.getSubmissionSummary.mockResolvedValue(SUMMARY);
    BulkPassSchema.getNextSubmissionNumber.mockResolvedValue(4);

    const res = await request(app).get("/api/bulk-pass/public/parent-token/submissions").expect(200);

    expect(res.body.data.multipleSubmissionsEnabled).toBe(true);
    expect(res.body.data.canSubmit).toBe(true);
    expect(res.body.data.submissionHistory).toHaveLength(3);
    expect(res.body.data.submissionSummary.totalPersons).toBe(45);
    expect(res.body.data.nextSubmissionNumber).toBe(4);
    expect(BulkPassSchema.getChildBatches).toHaveBeenCalledWith(42, "DEPARTMENT");
  });

  test("still returns the history once the bulk pass has expired", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(
      parentBatch({ validityUpto: PAST, tokenActive: false, tokenActiveRaw: true })
    );
    BulkPassSchema.getChildBatches.mockResolvedValue([
      { id: 1, refNo: "BP/2026/00050", submissionNumber: 1, personsCount: 20, vehiclesCount: 4, status: "COMPLETED" },
    ]);
    BulkPassSchema.getSubmissionSummary.mockResolvedValue({ ...SUMMARY, totalSubmissions: 1 });
    BulkPassSchema.getNextSubmissionNumber.mockResolvedValue(2);

    const res = await request(app).get("/api/bulk-pass/public/parent-token/submissions").expect(200);

    expect(res.body.data.canSubmit).toBe(false);
    expect(res.body.data.validity.state).toBe("EXPIRED");
    expect(res.body.data.submissionHistory).toHaveLength(1);
  });

  test("reports an empty history for a single-submission link", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(
      parentBatch({ multipleSubmissionsEnabled: false })
    );

    const res = await request(app).get("/api/bulk-pass/public/single-token/submissions").expect(200);

    expect(res.body.data.multipleSubmissionsEnabled).toBe(false);
    expect(res.body.data.submissionHistory).toEqual([]);
    expect(res.body.data.canSubmit).toBe(false);
    expect(BulkPassSchema.getChildBatches).not.toHaveBeenCalled();
  });

  test("reads from the public request table when the token is a parent request", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(null);
    BulkPassParentRequest.findByToken.mockResolvedValue({
      id: 77,
      tracking_number: "TEMP-77",
      company_name: "Port Services Pvt Ltd",
      status: "ACTIVE",
      token_active: true,
      approved_time_from: PAST,
      approved_time_upto: FUTURE,
      no_of_persons: 30,
      no_of_vehicles: 30,
    });
    BulkPassSchema.getChildBatches.mockResolvedValue([]);
    BulkPassSchema.getSubmissionSummary.mockResolvedValue({
      totalSubmissions: 0, totalPersons: 0, totalVehicles: 0, byStatus: {}, lastSubmissionAt: null,
    });
    BulkPassSchema.getNextSubmissionNumber.mockResolvedValue(1);

    const res = await request(app).get("/api/bulk-pass/public/public-token/submissions").expect(200);

    expect(res.body.data.multipleSubmissionsEnabled).toBe(true);
    expect(BulkPassSchema.getChildBatches).toHaveBeenCalledWith(77, "PUBLIC_WEBSITE");
  });

  test("404s on an unknown link", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(null);

    const res = await request(app).get("/api/bulk-pass/public/nope/submissions").expect(404);
    expect(res.body.success).toBe(false);
  });
});

describe("GET /public/:token/submissions/:submissionId", () => {
  const personRows = [
    { id: 11, name: "A Kumar", aadhaar: "123456789012", mobile: "9876543210", vehicleNumber: null, approvalStatus: "APPROVED" },
    { id: 12, name: "B Raj", aadhaar: "223456789012", mobile: "9876543211", vehicleNumber: "", approvalStatus: "REJECTED", approvalReason: "Blacklisted" },
    { id: 13, name: "C Driver", aadhaar: "323456789012", mobile: "9876543212", vehicleNumber: "TN01AB1234", vehicleType: "Truck", approvalStatus: "PENDING" },
  ];

  beforeEach(() => {
    BulkPassSchema.getByToken.mockResolvedValue(parentBatch());
  });

  test("returns the batch with persons and vehicles split apart", async () => {
    BulkPassSchema.getChildBatchById.mockResolvedValue({
      id: 51,
      refNo: "BP/2026/00051",
      submission_number: 2,
      request_source: "DEPARTMENT",
      status: "UNDER_REVIEW",
      validityUpto: FUTURE,
      createdAt: "2026-09-01T09:00:00Z",
    });
    BulkPassSchema.getPersonsByBatch.mockResolvedValue(personRows);
    BulkPassSchema.getStatusLog.mockResolvedValue([
      { status: "UNDER_REVIEW", remarks: "Applicant submitted", createdAt: "2026-09-01T09:00:00Z" },
    ]);

    const res = await request(app)
      .get("/api/bulk-pass/public/parent-token/submissions/51")
      .expect(200);

    expect(res.body.data.submission.submissionNumber).toBe(2);
    expect(res.body.data.persons).toHaveLength(2);
    expect(res.body.data.vehicles).toHaveLength(1);
    expect(res.body.data.submission.personsCount).toBe(2);
    expect(res.body.data.submission.vehiclesCount).toBe(1);
    expect(res.body.data.statusLog).toHaveLength(1);
    // Scoped to this bulk pass, never by id alone.
    expect(BulkPassSchema.getChildBatchById).toHaveBeenCalledWith(42, 51);
  });

  test("masks Aadhaar numbers", async () => {
    BulkPassSchema.getChildBatchById.mockResolvedValue({ id: 51, submission_number: 2 });
    BulkPassSchema.getPersonsByBatch.mockResolvedValue(personRows);
    BulkPassSchema.getStatusLog.mockResolvedValue([]);

    const res = await request(app)
      .get("/api/bulk-pass/public/parent-token/submissions/51")
      .expect(200);

    expect(res.body.data.persons[0].aadhaar).toBe("XXXX XXXX 9012");
    expect(JSON.stringify(res.body)).not.toContain("123456789012");
  });

  test("refuses a batch that belongs to a different bulk pass", async () => {
    BulkPassSchema.getChildBatchById.mockResolvedValue(null);

    const res = await request(app)
      .get("/api/bulk-pass/public/parent-token/submissions/999")
      .expect(404);

    expect(res.body.message).toMatch(/not found for this bulk pass/i);
  });

  test("rejects a non-numeric submission id", async () => {
    const res = await request(app)
      .get("/api/bulk-pass/public/parent-token/submissions/abc")
      .expect(400);

    expect(res.body.message).toMatch(/invalid submission/i);
  });

  test("404s on an unknown link", async () => {
    BulkPassSchema.getByToken.mockResolvedValue(null);

    await request(app).get("/api/bulk-pass/public/nope/submissions/1").expect(404);
  });
});
