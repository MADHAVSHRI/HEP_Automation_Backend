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
  combineValidity,
  formatValidityDateTime,
  getLinkState,
} = require("../src/utils/bulkPassValidity");

const NOW = new Date("2026-09-21T10:00:00.000Z");

const daysFromNow = (n) => new Date(NOW.getTime() + n * 86400000).toISOString();

describe("resolveValidityWindow", () => {
  test("reads the camelCase batch shape", () => {
    const w = resolveValidityWindow({
      validityFrom: "2026-09-01T00:30:00Z",
      validityUpto: "2026-10-01T12:30:59.999Z",
    });
    // Stored date + time instants are kept as-is
    expect(w.validityFrom.toISOString()).toBe("2026-09-01T00:30:00.000Z");
    expect(w.validityUpto.toISOString()).toBe("2026-10-01T12:30:59.999Z");
  });

  test("prefers the approved window over the requested one on a public request", () => {
    const w = resolveValidityWindow({
      validity_from: "2026-01-01T00:00:00Z",
      validity_upto: "2026-02-01T12:00:00Z",
      approved_time_from: "2026-03-01T00:30:00Z",
      approved_time_upto: "2026-04-01T12:30:59.999Z",
    });
    expect(w.validityFrom.toISOString()).toBe("2026-03-01T00:30:00.000Z");
    expect(w.validityUpto.toISOString()).toBe("2026-04-01T12:30:59.999Z");
  });

  test("returns nulls for a record with no window", () => {
    expect(resolveValidityWindow({})).toEqual({ validityFrom: null, validityUpto: null });
    expect(resolveValidityWindow(null)).toEqual({ validityFrom: null, validityUpto: null });
  });
});

describe("normalizeValidityUpto", () => {
  test("a bare date closes at the default 18:00 IST", () => {
    expect(normalizeValidityUpto("2026-09-30").toISOString()).toBe("2026-09-30T12:30:59.999Z");
  });

  test("a legacy midnight (IST or UTC) runs to the end of that IST day", () => {
    expect(normalizeValidityUpto("2026-09-29T18:30:00.000Z").toISOString()).toBe("2026-09-30T18:29:59.999Z");
    expect(normalizeValidityUpto("2026-09-30T00:00:00.000Z").toISOString()).toBe("2026-09-30T18:29:59.999Z");
  });

  test("an explicit date + time is kept", () => {
    expect(normalizeValidityUpto("2026-09-30T09:00:59.999Z").toISOString()).toBe("2026-09-30T09:00:59.999Z");
  });

  test("returns null for unusable input", () => {
    expect(normalizeValidityUpto(null)).toBeNull();
    expect(normalizeValidityUpto("not a date")).toBeNull();
  });
});

describe("combineValidity", () => {
  test("a date alone gets the 06:00 / 18:00 IST default", () => {
    expect(combineValidity("2026-10-01").toISOString()).toBe("2026-10-01T00:30:00.000Z");
    expect(combineValidity("2026-10-02", undefined, { upto: true }).toISOString()).toBe("2026-10-02T12:30:59.999Z");
  });

  test("a chosen time is used, and an upto covers its whole minute", () => {
    expect(combineValidity("2026-10-01", "09:15").toISOString()).toBe("2026-10-01T03:45:00.000Z");
    expect(combineValidity("2026-10-02", "05:30", { upto: true }).toISOString()).toBe("2026-10-02T00:00:59.999Z");
  });

  test("rejects bad dates and times", () => {
    expect(combineValidity("2026-02-31")).toBeNull();
    expect(combineValidity("2026-10-01", "25:00")).toBeNull();
  });

  test("formats as DD/MM/YYYY HH:MM in IST", () => {
    expect(formatValidityDateTime(combineValidity("2026-10-01"))).toBe("01/10/2026 06:00");
    expect(formatValidityDateTime(combineValidity("2026-10-02", null, { upto: true }))).toBe("02/10/2026 18:00");
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
    expect(v.daysRemaining).toBe(20);
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

  test("a window inside the pass defaults to 06:00 – 18:00 IST", () => {
    const r = resolveBatchValidity({ validityFrom: "2026-09-22", validityUpto: "2026-09-24" }, pass, NOW);
    expect(r.ok).toBe(true);
    expect(r.validityFrom.toISOString()).toBe("2026-09-22T00:30:00.000Z");
    expect(r.validityUpto.toISOString()).toBe("2026-09-24T12:30:59.999Z");
  });

  test("the applicant may choose the times", () => {
    const r = resolveBatchValidity(
      { validityFrom: "2026-09-22", validityFromTime: "08:00", validityUpto: "2026-09-24", validityUptoTime: "20:30" },
      pass,
      NOW
    );
    expect(r.ok).toBe(true);
    expect(r.validityFrom.toISOString()).toBe("2026-09-22T02:30:00.000Z");
    expect(r.validityUpto.toISOString()).toBe("2026-09-24T15:00:59.999Z");
  });

  test("times must be valid and keep upto after from, inside the pass", () => {
    const base = { validityFrom: "2026-09-22", validityUpto: "2026-09-22" };
    expect(resolveBatchValidity({ ...base, validityFromTime: "7pm" }, pass, NOW)).toMatchObject({ ok: false, field: "validityFrom" });
    expect(resolveBatchValidity({ ...base, validityFromTime: "18:00", validityUptoTime: "09:00" }, pass, NOW)).toMatchObject({ ok: false, field: "validityUpto" });
    // pass ends 10 Oct 18:00 IST (bare date default)
    expect(resolveBatchValidity({ validityFrom: "2026-10-10", validityUpto: "2026-10-10", validityUptoTime: "19:00" }, pass, NOW)).toMatchObject({ ok: false, field: "validityUpto" });
  });

  test("a batch ending today at a time already past is refused", () => {
    // NOW is 15:30 IST
    expect(resolveBatchValidity({ validityFrom: "2026-09-21", validityUpto: "2026-09-21", validityUptoTime: "12:00" }, pass, NOW)).toMatchObject({ ok: false, field: "validityUpto" });
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

describe("getLinkState — the applicant link is open from creation until expiry", () => {
  const pass = {
    createdAt: daysFromNow(-1),
    validityFrom: daysFromNow(5),
    validityUpto: daysFromNow(20),
  };

  test("open before the visit window starts, flagged as visits-not-started", () => {
    expect(getValidityState(pass, NOW).state).toBe("NOT_STARTED");
    const link = getLinkState(pass, NOW);
    expect(link.state).toBe("ACTIVE");
    expect(link.canSubmit).toBe(true);
    expect(link.visitsNotStarted).toBe(true);
    // The pass's own visit start is still what is shown.
    expect(link.validityFrom).toBe(getValidityState(pass, NOW).validityFrom);
  });

  test("closed once the pass expires", () => {
    const link = getLinkState({ ...pass, validityUpto: daysFromNow(-1) }, NOW);
    expect(link.state).toBe("EXPIRED");
    expect(link.canSubmit).toBe(false);
  });

  test("a public request opens at approval", () => {
    const link = getLinkState({
      created_at: daysFromNow(-10),
      approved_at: daysFromNow(-2),
      approved_time_from: daysFromNow(3),
      approved_time_upto: daysFromNow(9),
    }, NOW);
    expect(link.canSubmit).toBe(true);
    expect(link.linkOpensAt).toBe(new Date(daysFromNow(-2)).toISOString());
  });
});
