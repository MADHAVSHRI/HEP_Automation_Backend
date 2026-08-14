"use strict";

/**
 * customs-service — API tests
 *
 * All database calls and bcrypt are mocked so tests run without a live DB.
 * Tests cover Login, Rapiscan Push, and Customs Physical Examination per the
 * latest API specification.
 */

// --------------------------------------------------------------------------
// 1.  Module mocks — must be declared before any require() that loads them
// --------------------------------------------------------------------------

// Mock sequelize models
jest.mock("../models", () => {
  const mockOperator = {
    id: 1,
    loginId: "CUSTOMS001",
    password: "$2b$10$hashedpassword",
    isActive: true,
  };

  const CustomsOperator = {
    scope: jest.fn().mockReturnThis(),
    findOne: jest.fn(),
    findByPk: jest.fn(),
  };

  const CustomsExamination = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const CustomsRapiscan = {
    create: jest.fn(),
  };

  const CustomsOoc = {
    findOne: jest.fn(),
    create: jest.fn(),
  };

  // Allow each test to configure these mocks
  return {
    CustomsOperator,
    CustomsExamination,
    CustomsRapiscan,
    CustomsOoc,
    sequelize: { transaction: jest.fn() },
    _mockOperator: mockOperator,
  };
});

// Mock bcrypt to avoid native-module issues in tests
jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

// Mock JWT utils
jest.mock("../src/utils/jwt", () => ({
  signToken: jest.fn().mockReturnValue("test.jwt.token"),
  verifyToken: jest.fn().mockReturnValue({ id: 1, loginId: "CUSTOMS001" }),
}));

// --------------------------------------------------------------------------
// 2.  Imports (after mocks)
// --------------------------------------------------------------------------
const request = require("supertest");
const express = require("express");
const bcrypt = require("bcrypt");
const {
  CustomsOperator,
  CustomsExamination,
  CustomsRapiscan,
  _mockOperator,
} = require("../models");

// Build a minimal Express app — mirrors src/index.js without DB connection
const customsRoutes = require("../src/routes/customsRoutes");
const app = express();
app.use(express.json());
app.use("/api/customs", customsRoutes);

// Helper: configure operator mocks for "logged-in" state
function mockValidOperator() {
  CustomsOperator.scope.mockReturnThis();
  CustomsOperator.findOne.mockResolvedValue(_mockOperator);
  CustomsOperator.findByPk.mockResolvedValue(_mockOperator);
  bcrypt.compare.mockResolvedValue(true);
}

// Helper: get a valid bearer token string (we use the middleware's findByPk mock)
const VALID_TOKEN = "Bearer test.jwt.token";

// --------------------------------------------------------------------------
// 3.  Tests
// --------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

// ==========================================================================
// LOGIN
// ==========================================================================

describe("POST /api/customs/login", () => {
  test("200 — successful login returns token", async () => {
    mockValidOperator();

    const res = await request(app).post("/api/customs/login").send({
      loginId: "CUSTOMS001",
      password: "correct_password",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Login successful");
    expect(res.body.token).toBeDefined();
    // Spec does NOT include a top-level 'data' field in login response
    expect(res.body.data).toBeUndefined();
  });

  test("401 — invalid credentials", async () => {
    CustomsOperator.scope.mockReturnThis();
    CustomsOperator.findOne.mockResolvedValue(_mockOperator);
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app).post("/api/customs/login").send({
      loginId: "CUSTOMS001",
      password: "wrong_password",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid login ID or password");
  });

  test("401 — operator not found", async () => {
    CustomsOperator.scope.mockReturnThis();
    CustomsOperator.findOne.mockResolvedValue(null);
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app).post("/api/customs/login").send({
      loginId: "UNKNOWN",
      password: "any_password",
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("400 — missing loginId", async () => {
    const res = await request(app).post("/api/customs/login").send({
      password: "correct_password",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test("400 — missing password", async () => {
    const res = await request(app).post("/api/customs/login").send({
      loginId: "CUSTOMS001",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ==========================================================================
// RAPISCAN PUSH
// ==========================================================================

describe("POST /api/customs/rapiscan/push", () => {
  const validRapiscanBody = {
    containerNumber: "MSCU1234567",
    containerSize: "40",
    scanningStatus: "Mismatch",
    scanningDateTime: "2026-08-07T11:30:00",
  };

  beforeEach(() => {
    // Auth middleware needs findByPk to return active operator
    mockValidOperator();
  });

  test("201 — valid Mismatch request", async () => {
    CustomsRapiscan.create.mockResolvedValue({});

    const res = await request(app)
      .post("/api/customs/rapiscan/push")
      .set("Authorization", VALID_TOKEN)
      .send(validRapiscanBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Rapiscan details received successfully.");
    expect(res.body.data).toMatchObject({
      containerNumber: "MSCU1234567",
      containerSize: "40",
      scanningStatus: "Mismatch",
      scanningDateTime: "2026-08-07T11:30:00",
    });
  });

  test("201 — valid Clean request", async () => {
    CustomsRapiscan.create.mockResolvedValue({});

    const res = await request(app)
      .post("/api/customs/rapiscan/push")
      .set("Authorization", VALID_TOKEN)
      .send({ ...validRapiscanBody, scanningStatus: "Clean" });

    expect(res.status).toBe(201);
    expect(res.body.data.scanningStatus).toBe("Clean");
  });

  test("400 — missing containerNumber", async () => {
    const { containerNumber, ...body } = validRapiscanBody;
    const res = await request(app)
      .post("/api/customs/rapiscan/push")
      .set("Authorization", VALID_TOKEN)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("containerNumber");
  });

  test("400 — missing containerSize", async () => {
    const { containerSize, ...body } = validRapiscanBody;
    const res = await request(app)
      .post("/api/customs/rapiscan/push")
      .set("Authorization", VALID_TOKEN)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("containerSize");
  });

  test("400 — invalid scanningStatus", async () => {
    const res = await request(app)
      .post("/api/customs/rapiscan/push")
      .set("Authorization", VALID_TOKEN)
      .send({ ...validRapiscanBody, scanningStatus: "Unknown" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("scanningStatus");
  });

  test("400 — missing scanningDateTime", async () => {
    const { scanningDateTime, ...body } = validRapiscanBody;
    const res = await request(app)
      .post("/api/customs/rapiscan/push")
      .set("Authorization", VALID_TOKEN)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("scanningDateTime");
  });

  test("400 — invalid scanningDateTime format", async () => {
    const res = await request(app)
      .post("/api/customs/rapiscan/push")
      .set("Authorization", VALID_TOKEN)
      .send({ ...validRapiscanBody, scanningDateTime: "07-08-2026 11:30" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("scanningDateTime");
  });

  test("401 — missing Authorization header", async () => {
    const res = await request(app)
      .post("/api/customs/rapiscan/push")
      .send(validRapiscanBody);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("401 — invalid JWT", async () => {
    const { verifyToken } = require("../src/utils/jwt");
    verifyToken.mockImplementationOnce(() => {
      throw new Error("invalid token");
    });

    const res = await request(app)
      .post("/api/customs/rapiscan/push")
      .set("Authorization", "Bearer bad.token.here")
      .send(validRapiscanBody);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ==========================================================================
// CUSTOMS PHYSICAL EXAMINATION
// ==========================================================================

describe("POST /api/customs/examination", () => {
  const validExaminationBody = {
    containerNumber: "MSCU1234567",
    igmNumber: "IGM20260001",
    dateOfExamination: "2026-08-07",
    examinationFindings: "No discrepancy found during physical examination.",
    discrepancyFound: "No",
  };

  const mockExaminationRecord = {
    containerNumber: "MSCU1234567",
    igmNumber: "IGM20260001",
    dateOfExamination: "2026-08-07",
    examinationFindings: "No discrepancy found during physical examination.",
    discrepancyFound: "No",
    createdAt: "2026-08-07T11:15:24.000Z",
  };

  beforeEach(() => {
    mockValidOperator();
    CustomsExamination.findOne.mockResolvedValue(null);
    CustomsExamination.create.mockResolvedValue(mockExaminationRecord);
  });

  test("201 — valid JSON request, no image upload required", async () => {
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .set("Content-Type", "application/json")
      .send(validExaminationBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe("Customs examination details saved successfully.");
    expect(res.body.data).toMatchObject({
      containerNumber: "MSCU1234567",
      igmNumber: "IGM20260001",
      dateOfExamination: "2026-08-07",
      examinationFindings: "No discrepancy found during physical examination.",
      discrepancyFound: "No",
    });
    expect(res.body.data.createdAt).toBeDefined();
  });

  test("201 — valid request with discrepancyFound=Yes", async () => {
    CustomsExamination.create.mockResolvedValue({
      ...mockExaminationRecord,
      discrepancyFound: "Yes",
    });

    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send({ ...validExaminationBody, discrepancyFound: "Yes" });

    expect(res.status).toBe(201);
    expect(res.body.data.discrepancyFound).toBe("Yes");
  });

  test("400 — missing containerNumber", async () => {
    const { containerNumber, ...body } = validExaminationBody;
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("containerNumber");
  });

  test("400 — missing igmNumber", async () => {
    const { igmNumber, ...body } = validExaminationBody;
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("igmNumber");
  });

  test("400 — missing dateOfExamination", async () => {
    const { dateOfExamination, ...body } = validExaminationBody;
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("dateOfExamination");
  });

  test("400 — invalid dateOfExamination format", async () => {
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send({ ...validExaminationBody, dateOfExamination: "07/08/2026" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("dateOfExamination");
  });

  test("400 — missing examinationFindings", async () => {
    const { examinationFindings, ...body } = validExaminationBody;
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("examinationFindings");
  });

  test("400 — missing discrepancyFound", async () => {
    const { discrepancyFound, ...body } = validExaminationBody;
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("discrepancyFound");
  });

  test("400 — invalid discrepancyFound value", async () => {
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send({ ...validExaminationBody, discrepancyFound: "Maybe" });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("discrepancyFound");
  });

  test("409 — duplicate examination (same container + IGM)", async () => {
    CustomsExamination.findOne.mockResolvedValue(mockExaminationRecord);

    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send(validExaminationBody);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test("401 — missing Authorization header", async () => {
    const res = await request(app)
      .post("/api/customs/examination")
      .send(validExaminationBody);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("401 — invalid JWT", async () => {
    const { verifyToken } = require("../src/utils/jwt");
    verifyToken.mockImplementationOnce(() => {
      throw new Error("invalid token");
    });

    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", "Bearer bad.token.here")
      .send(validExaminationBody);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("multipart/image upload is NOT required — JSON alone succeeds", async () => {
    // If the endpoint still required multipart this test would fail with 400.
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .set("Content-Type", "application/json")
      // No files attached — only JSON body
      .send(validExaminationBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test("old fields billNumber, billDate, chapterHeading are ignored (not required)", async () => {
    // Sending old fields should not cause errors; they are simply not stored
    const res = await request(app)
      .post("/api/customs/examination")
      .set("Authorization", VALID_TOKEN)
      .send({
        ...validExaminationBody,
        billNumber: "BILL001",
        billDate: "2026-08-01",
        chapterHeading: "Chapter 72",
      });

    // Should succeed — extra fields are ignored silently
    expect(res.status).toBe(201);
    // Verify old fields do not appear in response data
    expect(res.body.data.billNumber).toBeUndefined();
    expect(res.body.data.billDate).toBeUndefined();
    expect(res.body.data.chapterHeading).toBeUndefined();
  });
});
