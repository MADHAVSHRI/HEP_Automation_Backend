/**
 * Tests for the shared Bulk Pass validity rules.
 *
 * These rules decide the central business behaviour of the module: one link
 * accepts batch after batch until its validity expires, and not a moment
 * longer — while the history stays readable forever.
 */

const {
  getValidityState,
  isWithinValidity,
  resolveValidityWindow,
  normalizeValidityUpto,
  getBlockedMessage,
  resolveBatchValidity,
  getBatchValidityBounds,
  toIstDateKey,
} = require("../src/utils/bulkPassValidity");

const NOW = new Date("2026-09-21T10:00:00.000Z");

const daysFromNow = (n) => new Date(NOW.getTime() + n * 86400000).toISOString();

describe("resolveValidityWindow", () => {
  test("reads the camelCase batch shape", () => {
    const w = resolveValidityWindow({
      validityFrom: "2026-09-01T00:00:00Z",
      validityUpto: "2026-10-01T12:00:00Z",
    });
    // Date-only: the window opens at 00:00 IST of the from-day
    expect(w.validityFrom.toISOString()).toBe("2026-08-31T18:30:00.000Z");
    // Date-only validation: all dates extended to end of day in IST
    expect(w.validityUpto.toISOString()).toBe("2026-10-01T18:29:59.999Z");
  });

  test("prefers the approved window over the requested one on a public request", () => {
    const w = resolveValidityWindow({
      validity_from: "2026-01-01T00:00:00Z",
      validity_upto: "2026-02-01T12:00:00Z",
      approved_time_from: "2026-03-01T00:00:00Z",
      approved_time_upto: "2026-04-01T12:00:00Z",
    });
    expect(w.validityFrom.toISOString()).toBe("2026-02-28T18:30:00.000Z");
    // Date-only validation: all dates extended to end of day in IST
    expect(w.validityUpto.toISOString()).toBe("2026-04-01T18:29:59.999Z");
  });

  test("returns nulls for a record with no window", () => {
    expect(resolveValidityWindow({})).toEqual({ validityFrom: null, validityUpto: null });
    expect(resolveValidityWindow(null)).toEqual({ validityFrom: null, validityUpto: null });
  });
});

describe("normalizeValidityUpto", () => {
  test("always extends dates to end of day (date-only validation)", () => {
    // Date-only: all dates are extended to 23:59:59.999 regardless of input time
    const midnight = new Date(2026, 8, 30, 0, 0, 0, 0);
    const end = normalizeValidityUpto(midnight);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getDate()).toBe(30);
  });

  test("extends dates with explicit times to end of day (date-only)", () => {
    // Even dates with explicit times are extended to end of day
    const at = new Date(2026, 8, 30, 14, 30, 0, 0);
    const end = normalizeValidityUpto(at);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getDate()).toBe(30);
  });

  test("returns null for unusable input", () => {
    expect(normalizeValidityUpto(null)).toBeNull();
    expect(normalizeValidityUpto("not a date")).toBeNull();
  });
});

describe("getValidityState", () => {
  test("a bulk pass inside its window is ACTIVE and can accept batches", () => {
    const v = getValidityState(
      { validityFrom: daysFromNow(-10), validityUpto: daysFromNow(20) },
      NOW
    );
    expect(v.state).toBe("ACTIVE");
    expect(v.canSubmit).toBe(true);
    expect(v.expiringSoon).toBe(false);
    // Date-only validation extends to end of day, adding ~0.77 days (18.5h IST offset)
    // So 20 days → 20.77 days → rounds up to 21 days
    expect(v.daysRemaining).toBe(21);
  });

  test("a bulk pass with no validityFrom is open from the start", () => {
    const v = getValidityState({ validityUpto: daysFromNow(5) }, NOW);
    expect(v.state).toBe("ACTIVE");
    expect(v.canSubmit).toBe(true);
  });

  test("flags a bulk pass nearing expiry", () => {
    const v = getValidityState({ validityUpto: daysFromNow(2) }, NOW);
    expect(v.state).toBe("ACTIVE");
    expect(v.canSubmit).toBe(true);
    expect(v.expiringSoon).toBe(true);
  });

  test("a bulk pass past its window is EXPIRED and cannot accept batches", () => {
    const v = getValidityState(
      { validityFrom: daysFromNow(-30), validityUpto: daysFromNow(-1) },
      NOW
    );
    expect(v.state).toBe("EXPIRED");
    expect(v.canSubmit).toBe(false);
    expect(v.daysRemaining).toBe(0);
  });

  test("a bulk pass whose window has not opened is NOT_STARTED", () => {
    const v = getValidityState(
      { validityFrom: daysFromNow(3), validityUpto: daysFromNow(30) },
      NOW
    );
    expect(v.state).toBe("NOT_STARTED");
    expect(v.canSubmit).toBe(false);
  });

  test("a bulk pass with no end date cannot accept batches", () => {
    const v = getValidityState({ validityFrom: daysFromNow(-1) }, NOW);
    expect(v.state).toBe("UNKNOWN");
    expect(v.canSubmit).toBe(false);
  });

  test("uses the approved window for a public request", () => {
    const v = getValidityState(
      { approved_time_from: daysFromNow(-1), approved_time_upto: daysFromNow(7) },
      NOW
    );
    expect(v.state).toBe("ACTIVE");
    expect(v.canSubmit).toBe(true);
  });

  test("a validity ending today at midnight stays open all day", () => {
    const today = new Date(2026, 8, 21, 0, 0, 0, 0);
    const middayToday = new Date(2026, 8, 21, 12, 0, 0, 0);
    const v = getValidityState({ validityUpto: today }, middayToday);
    expect(v.state).toBe("ACTIVE");
    expect(v.canSubmit).toBe(true);
  });
});

describe("isWithinValidity", () => {
  test("mirrors canSubmit", () => {
    expect(isWithinValidity({ validityUpto: daysFromNow(1) }, NOW)).toBe(true);
    expect(isWithinValidity({ validityUpto: daysFromNow(-1) }, NOW)).toBe(false);
    expect(isWithinValidity(null, NOW)).toBe(false);
  });
});

describe("getBlockedMessage", () => {
  test("explains an expired pass without hiding the history", () => {
    const msg = getBlockedMessage({ state: "EXPIRED" });
    expect(msg).toMatch(/expired/i);
    expect(msg).toMatch(/previous submissions remain available/i);
  });

  test("returns null while the window is open", () => {
    expect(getBlockedMessage({ state: "ACTIVE" })).toBeNull();
  });

  test("explains a window that has not opened yet", () => {
    expect(getBlockedMessage({ state: "NOT_STARTED" })).toMatch(/not started/i);
  });
});

describe("per-batch validity chosen by the applicant", () => {
  // 21 Sep 2026, 15:30 IST
  const pass = { validityFrom: "2026-09-15", validityUpto: "2026-10-10" };

  test("bounds run from today (or the pass start, if later) to the pass end", () => {
    expect(getBatchValidityBounds(pass, NOW)).toEqual({ min: "2026-09-21", max: "2026-10-10" });
    expect(getBatchValidityBounds({ validityFrom: "2026-09-25", validityUpto: "2026-10-10" }, NOW).min).toBe("2026-09-25");
  });

  test("a window inside the pass is stored as whole IST days", () => {
    const r = resolveBatchValidity({ validityFrom: "2026-09-22", validityUpto: "2026-09-24" }, pass, NOW);
    expect(r.ok).toBe(true);
    expect(r.validityFrom.toISOString()).toBe("2026-09-21T18:30:00.000Z");
    expect(r.validityUpto.toISOString()).toBe("2026-09-24T18:29:59.999Z");
  });

  test("a single-day batch is allowed, including today", () => {
    expect(resolveBatchValidity({ validityFrom: "2026-09-21", validityUpto: "2026-09-21" }, pass, NOW).ok).toBe(true);
  });

  test("dates are required and must be real days", () => {
    expect(resolveBatchValidity({}, pass, NOW)).toMatchObject({ ok: false, field: "validityFrom" });
    expect(resolveBatchValidity({ validityFrom: "2026-09-22" }, pass, NOW)).toMatchObject({ ok: false, field: "validityUpto" });
    expect(resolveBatchValidity({ validityFrom: "2026-02-31", validityUpto: "2026-09-24" }, pass, NOW).ok).toBe(false);
  });

  test("a batch cannot start in the past or before the pass", () => {
    expect(resolveBatchValidity({ validityFrom: "2026-09-20", validityUpto: "2026-09-24" }, pass, NOW)).toMatchObject({ ok: false, field: "validityFrom" });
  });

  test("a batch cannot end before it starts or after the pass", () => {
    expect(resolveBatchValidity({ validityFrom: "2026-09-24", validityUpto: "2026-09-22" }, pass, NOW)).toMatchObject({ ok: false, field: "validityUpto" });
    expect(resolveBatchValidity({ validityFrom: "2026-09-24", validityUpto: "2026-10-11" }, pass, NOW)).toMatchObject({ ok: false, field: "validityUpto" });
  });

  test("the IST day is used, whatever the server timezone", () => {
    expect(toIstDateKey("2026-09-30T18:29:59.999Z")).toBe("2026-09-30");
    expect(toIstDateKey("2026-09-30T18:30:00.000Z")).toBe("2026-10-01");
  });
});
