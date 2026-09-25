/**
 * Tests for the batch-submission rate limiter.
 *
 * The submit endpoint is unauthenticated and a reusable link stays live for its
 * whole validity window, so velocity has to be bounded independently of the
 * cumulative budget on the pass itself.
 */

const mockRedis = {
  get: jest.fn(),
  setEx: jest.fn(),
  ttl: jest.fn(),
};

jest.mock("../config/redisClient", () => mockRedis);

const {
  checkBulkSubmissionRateLimit,
  bulkSubmissionRateLimiter,
} = require("../src/middlewares/rateLimitMiddleware");

const ORIGINAL_ENV = process.env.NODE_ENV;

beforeEach(() => {
  jest.clearAllMocks();
  // The limiter deliberately stands down in development so local testing is
  // not throttled; exercise the production path here.
  process.env.NODE_ENV = "production";
  mockRedis.get.mockResolvedValue(null);
  mockRedis.setEx.mockResolvedValue("OK");
  mockRedis.ttl.mockResolvedValue(1800);
});

afterAll(() => {
  process.env.NODE_ENV = ORIGINAL_ENV;
});

describe("checkBulkSubmissionRateLimit", () => {
  test("allows a first submission and records it against every window", async () => {
    const result = await checkBulkSubmissionRateLimit("token-a", "10.0.0.1");

    expect(result.allowed).toBe(true);
    const keys = mockRedis.setEx.mock.calls.map((c) => c[0]);
    expect(keys).toEqual([
      "ratelimit:bulksubmit:token:hour:token-a",
      "ratelimit:bulksubmit:token:day:token-a",
      "ratelimit:bulksubmit:ip:hour:10.0.0.1",
    ]);
  });

  test("blocks once the hourly per-link allowance is spent", async () => {
    mockRedis.get.mockImplementation(async (key) =>
      key.includes("token:hour") ? "5" : null
    );

    const result = await checkBulkSubmissionRateLimit("token-a", "10.0.0.1");

    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/too many batch submissions/i);
    expect(result.retryAfter).toBe(1800);
    // Nothing is counted once a request is refused.
    expect(mockRedis.setEx).not.toHaveBeenCalled();
  });

  test("blocks once the daily per-link allowance is spent", async () => {
    mockRedis.get.mockImplementation(async (key) =>
      key.includes("token:day") ? "30" : null
    );

    const result = await checkBulkSubmissionRateLimit("token-a", "10.0.0.1");

    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/daily submission limit/i);
  });

  test("blocks a single network flooding many links", async () => {
    mockRedis.get.mockImplementation(async (key) => (key.includes("ip:hour") ? "20" : null));

    const result = await checkBulkSubmissionRateLimit("token-a", "10.0.0.1");

    expect(result.allowed).toBe(false);
    expect(result.message).toMatch(/from this network/i);
  });

  test("counts each link separately so one abuser cannot starve the rest", async () => {
    mockRedis.get.mockImplementation(async (key) =>
      key === "ratelimit:bulksubmit:token:hour:busy" ? "5" : null
    );

    await expect(checkBulkSubmissionRateLimit("busy", "10.0.0.1")).resolves.toMatchObject({
      allowed: false,
    });
    await expect(checkBulkSubmissionRateLimit("quiet", "10.0.0.2")).resolves.toMatchObject({
      allowed: true,
    });
  });

  test("fails open when Redis is unavailable", async () => {
    mockRedis.get.mockRejectedValue(new Error("connection refused"));

    const result = await checkBulkSubmissionRateLimit("token-a", "10.0.0.1");

    // A limiter outage must not stop legitimate applicants from submitting.
    expect(result.allowed).toBe(true);
  });
});

describe("bulkSubmissionRateLimiter middleware", () => {
  const runMiddleware = async (req) => {
    const res = {
      statusCode: null,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
    const next = jest.fn();
    await bulkSubmissionRateLimiter(req, res, next);
    return { res, next };
  };

  test("passes the request through when under the limit", async () => {
    const { res, next } = await runMiddleware({ params: { token: "t" }, ip: "10.0.0.1", headers: {} });

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });

  test("answers 429 with a retry hint when over the limit", async () => {
    mockRedis.get.mockImplementation(async (key) => (key.includes("token:hour") ? "5" : null));

    const { res, next } = await runMiddleware({ params: { token: "t" }, ip: "10.0.0.1", headers: {} });

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.retryAfter).toBe(1800);
  });

  test("does nothing when the route carries no token", async () => {
    const { res, next } = await runMiddleware({ params: {}, ip: "10.0.0.1", headers: {} });

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeNull();
  });
});
