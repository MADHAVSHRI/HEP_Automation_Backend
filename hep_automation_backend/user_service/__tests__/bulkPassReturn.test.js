/**
 * Return for revision with per-row reasons
 * (POST /api/bulk-pass/:id/return).
 *
 * The officer marks the persons / vehicles that need fixing, each with its own
 * reason; those rows reach the applicant's correction link highlighted.
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
jest.mock("axios");

const BulkPassSchema = require("../src/models/bulkPassSchema");
const bulkPassController = require("../src/controllers/bulkPassController");

const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.user = { userId: 7 }; next(); });
app.post("/api/bulk-pass/:id/return", bulkPassController.returnToApplicant);

const batch = {
  id: 5,
  refNo: "BP/2026/00005",
  status: "UNDER_REVIEW",
  token: "t",
  applicantEmail: "a@b.co",
  companyName: "Acme",
  validityUpto: new Date(Date.now() + 5 * 86400000).toISOString(),
};
const persons = [
  { id: 11, name: "Arun", aadhaar: "123456789012", approvalStatus: "PENDING" },
  { id: 12, name: "Priya", aadhaar: "223456789012", approvalStatus: "PENDING" },
];

beforeEach(() => {
  jest.clearAllMocks();
  BulkPassSchema.getById.mockResolvedValue(batch);
  BulkPassSchema.getPersonsByBatch.mockResolvedValue(persons);
  BulkPassSchema.setStatus.mockResolvedValue({ ...batch, status: "RETURNED_TO_APPLICANT" });
  BulkPassSchema.logTransition.mockResolvedValue({});
  BulkPassSchema.setPersonApprovalStatus.mockResolvedValue({});
});

const send = (body) => request(app).post("/api/bulk-pass/5/return").send(body);

describe("return for revision", () => {
  test("marks each chosen row with its own reason", async () => {
    const res = await send({
      returnReason: "Two photos need replacing",
      flagged: [{ id: 12, reason: "Photo is blurred" }],
    });

    expect(res.status).toBe(200);
    expect(BulkPassSchema.setPersonApprovalStatus).toHaveBeenCalledWith(12, "REJECTED", "Photo is blurred", 7);
    expect(BulkPassSchema.setPersonApprovalStatus).toHaveBeenCalledTimes(1);
    expect(BulkPassSchema.setStatus).toHaveBeenCalledWith(5, "RETURNED_TO_APPLICANT", expect.objectContaining({ returnReason: "Two photos need replacing" }));
  });

  test("the overall note is optional once rows are marked", async () => {
    const res = await send({ flagged: [{ id: 11, reason: "Name does not match Aadhaar" }] });

    expect(res.status).toBe(200);
    expect(BulkPassSchema.setStatus).toHaveBeenCalledWith(
      5, "RETURNED_TO_APPLICANT",
      expect.objectContaining({ returnReason: expect.stringMatching(/correct the 1 highlighted entry/) })
    );
  });

  test("a note is still required when nothing is marked", async () => {
    const res = await send({});
    expect(res.status).toBe(400);
    expect(BulkPassSchema.setStatus).not.toHaveBeenCalled();
  });

  test("every marked row needs a reason", async () => {
    const res = await send({ flagged: [{ id: 11, reason: "" }] });
    expect(res.status).toBe(400);
    expect(BulkPassSchema.setPersonApprovalStatus).not.toHaveBeenCalled();
  });

  test("rows from another batch are refused", async () => {
    const res = await send({ returnReason: "x", flagged: [{ id: 999, reason: "Photo is blurred" }] });
    expect(res.status).toBe(400);
    expect(BulkPassSchema.setPersonApprovalStatus).not.toHaveBeenCalled();
    expect(BulkPassSchema.setStatus).not.toHaveBeenCalled();
  });

  test("a plain return still works", async () => {
    const res = await send({ returnReason: "Please re-upload the work order" });
    expect(res.status).toBe(200);
    expect(BulkPassSchema.setPersonApprovalStatus).not.toHaveBeenCalled();
  });
});
