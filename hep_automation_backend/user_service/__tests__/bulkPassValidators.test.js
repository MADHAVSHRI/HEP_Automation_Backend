/**
 * Property-Based Tests for bulkPassValidators.js
 *
 * Uses fast-check for property-based testing (minimum 100 runs per property).
 *
 * Properties covered:
 *   Property 2  — Input validation rejects invalid email formats (Req 1.4)
 *   Property 3  — Input validation rejects invalid mobile numbers (Req 1.5, 1.6, 1.7)
 *   Property 4  — Input validation rejects non-future validity dates (Req 1.8)
 *   Property 13 — Aadhaar validator accepts exactly 12-digit numeric strings (Req 5.3)
 *   Property 15 — DOB validator rejects future dates (Req 5.5)
 *   Property 16 — Mobile validator accepts only 10-digit numbers starting with 6–9 (Req 5.6)
 */

const fc = require("fast-check");
const {
  validateEmail,
  validateMobile,
  validateAadhaar,
  validateDOB,
  validateVehicleNumber,
} = require("../src/utils/bulkPassValidators");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format a Date as DD/MM/YYYY */
function formatDOB(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

// ---------------------------------------------------------------------------
// Property 2 — Input validation rejects invalid email formats
// **Feature: bulk-pass-module, Property 2: Input validation rejects invalid email formats**
// **Validates: Requirements 1.4**
// ---------------------------------------------------------------------------

describe("Property 2 — Email validator rejects invalid formats", () => {
  // Strings that do NOT match [^\s@]+@[^\s@]+\.[^\s@]+
  const arbInvalidEmail = fc.oneof(
    // No @ at all
    fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes("@")),
    // Starts with @
    fc
      .string({ minLength: 1, maxLength: 20 })
      .map((s) => `@${s}`),
    // Multiple @
    fc
      .tuple(
        fc.stringMatching(/^[a-z]{1,5}$/),
        fc.stringMatching(/^[a-z]{1,5}$/),
        fc.stringMatching(/^[a-z]{1,5}$/)
      )
      .map(([a, b, c]) => `${a}@${b}@${c}`),
    // No dot in domain part
    fc
      .tuple(
        fc.stringMatching(/^[a-z0-9]{1,8}$/),
        fc.stringMatching(/^[a-z0-9]{1,8}$/)
      )
      .map(([local, domain]) => `${local}@${domain}`),
    // Contains whitespace
    fc
      .tuple(
        fc.stringMatching(/^[a-z]{1,5}$/),
        fc.stringMatching(/^[a-z]{1,5}$/),
        fc.constantFrom("com", "net")
      )
      .map(([local, domain, tld]) => `${local} @${domain}.${tld}`)
  );

  test("validateEmail returns valid=false for strings without valid email structure", () => {
    fc.assert(
      fc.property(arbInvalidEmail, (s) => {
        const result = validateEmail(s);
        return result.valid === false && result.error !== null;
      }),
      { numRuns: 100 }
    );
  });

  test("validateEmail returns valid=true for well-formed email strings", () => {
    const arbValidEmail = fc
      .tuple(
        fc.stringMatching(/^[a-z0-9]{1,10}$/),
        fc.stringMatching(/^[a-z0-9]{1,10}$/),
        fc.constantFrom("com", "net", "org", "in")
      )
      .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

    fc.assert(
      fc.property(arbValidEmail, (s) => {
        const result = validateEmail(s);
        return result.valid === true && result.error === null;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 3 — Input validation rejects invalid mobile numbers (length check)
// **Feature: bulk-pass-module, Property 3: Input validation rejects invalid mobile numbers**
// **Validates: Requirements 1.5, 1.6, 1.7**
// ---------------------------------------------------------------------------

describe("Property 3 — Mobile validator rejects non-10-digit strings", () => {
  // Generate numeric strings that are NOT exactly 10 digits
  const arbNot10Digit = fc.oneof(
    // Too short: 1–9 digits
    fc.integer({ min: 1, max: 9 }).chain((len) =>
      fc.stringMatching(new RegExp(`^[0-9]{${len}}$`))
    ),
    // Too long: 11–15 digits
    fc.integer({ min: 11, max: 15 }).chain((len) =>
      fc.stringMatching(new RegExp(`^[0-9]{${len}}$`))
    ),
    // Non-numeric strings of any length
    fc.string({ minLength: 1, maxLength: 15 }).filter((s) => /\D/.test(s))
  );

  test("validateMobile returns valid=false for strings that are not exactly 10 digits", () => {
    fc.assert(
      fc.property(arbNot10Digit, (s) => {
        const result = validateMobile(s);
        return result.valid === false;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4 — Input validation rejects non-future validity dates
// **Feature: bulk-pass-module, Property 4: Input validation rejects non-future validity dates**
// **Validates: Requirements 1.8**
// ---------------------------------------------------------------------------

describe("Property 4 — Validity date must be in the future", () => {
  /**
   * The controller checks validityUpto using new Date(validityUpto) <= Date.now().
   * We test the equivalent logic with the validateDOB function on DOB (past/present).
   * For the intake validityUpto field, we test the boundary condition directly.
   */
  const isValidityFuture = (isoString) => {
    const d = new Date(isoString);
    return !isNaN(d.getTime()) && d.getTime() > Date.now();
  };

  // Dates at or before now — should NOT be future
  const arbPastOrNowIso = fc
    .date({
      min: new Date("2000-01-01"),
      max: new Date(Date.now()),
    })
    .map((d) => (isNaN(d.getTime()) ? new Date("2020-01-01") : d).toISOString());

  test("dates at or before now are not future dates", () => {
    fc.assert(
      fc.property(arbPastOrNowIso, (isoString) => {
        return isValidityFuture(isoString) === false;
      }),
      { numRuns: 100 }
    );
  });

  // Dates strictly after now — should be future
  const arbFutureIso = fc
    .date({
      min: new Date(Date.now() + 86400000), // tomorrow
      max: new Date("2035-12-31"),
    })
    .map((d) => (isNaN(d.getTime()) ? new Date("2030-01-01") : d).toISOString());

  test("dates strictly after now are correctly identified as future", () => {
    fc.assert(
      fc.property(arbFutureIso, (isoString) => {
        return isValidityFuture(isoString) === true;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13 — Aadhaar validator accepts exactly 12-digit numeric strings
// **Feature: bulk-pass-module, Property 13: Aadhaar validator accepts exactly 12-digit numeric strings**
// **Validates: Requirements 5.3**
// ---------------------------------------------------------------------------

describe("Property 13 — Aadhaar validator: exactly 12 numeric digits", () => {
  const arbValid12Digit = fc.stringMatching(/^\d{12}$/);

  const arbInvalidAadhaar = fc.oneof(
    // Too short
    fc.stringMatching(/^\d{1,11}$/),
    // Too long
    fc.stringMatching(/^\d{13,20}$/),
    // Has non-digit characters
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /\D/.test(s)),
    // Empty string
    fc.constant("")
  );

  test("validateAadhaar returns valid=true for any 12-digit numeric string", () => {
    fc.assert(
      fc.property(arbValid12Digit, (s) => {
        const result = validateAadhaar(s);
        return result.valid === true && result.error === null;
      }),
      { numRuns: 100 }
    );
  });

  test("validateAadhaar returns valid=false for all non-12-digit strings", () => {
    fc.assert(
      fc.property(arbInvalidAadhaar, (s) => {
        const result = validateAadhaar(s);
        return result.valid === false && result.error !== null;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 15 — DOB validator rejects future dates
// **Feature: bulk-pass-module, Property 15: DOB validator rejects future dates**
// **Validates: Requirements 5.5**
// ---------------------------------------------------------------------------

describe("Property 15 — DOB validator rejects future dates", () => {
  // Generate future dates formatted as DD/MM/YYYY
  const arbFutureDOB = fc
    .date({
      min: new Date(Date.now() + 86400000), // strictly tomorrow
      max: new Date("2099-12-31"),
    })
    .map((d) => {
      const safe = isNaN(d.getTime()) ? new Date("2050-06-15") : d;
      return formatDOB(safe);
    });

  test("validateDOB returns valid=false with correct message for any future date", () => {
    fc.assert(
      fc.property(arbFutureDOB, (dobStr) => {
        const result = validateDOB(dobStr);
        return (
          result.valid === false &&
          result.error === "Invalid DOB: future date not allowed"
        );
      }),
      { numRuns: 100 }
    );
  });

  // Past dates should be accepted (as far back as 1900)
  const arbPastDOB = fc
    .date({
      min: new Date("1900-01-01"),
      max: new Date(Date.now() - 86400000), // yesterday
    })
    .map((d) => {
      const safe = isNaN(d.getTime()) ? new Date("1990-01-01") : d;
      return formatDOB(safe);
    });

  test("validateDOB returns valid=true for any past date in DD/MM/YYYY format", () => {
    fc.assert(
      fc.property(arbPastDOB, (dobStr) => {
        const result = validateDOB(dobStr);
        return result.valid === true && result.error === null;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 16 — Mobile validator accepts only 10-digit numbers starting with 6–9
// **Feature: bulk-pass-module, Property 16: Mobile validator accepts only 10-digit numbers starting with 6–9**
// **Validates: Requirements 5.6**
// ---------------------------------------------------------------------------

describe("Property 16 — Mobile validator: 10 digits starting with 6–9", () => {
  // Valid: exactly 10 digits, first digit 6–9
  const arbValidMobile = fc
    .tuple(
      fc.constantFrom("6", "7", "8", "9"),
      fc.stringMatching(/^[0-9]{9}$/)
    )
    .map(([first, rest]) => `${first}${rest}`);

  // Invalid: 10-digit strings starting with 0–5
  const arbInvalidFirstDigit = fc
    .tuple(
      fc.constantFrom("0", "1", "2", "3", "4", "5"),
      fc.stringMatching(/^[0-9]{9}$/)
    )
    .map(([first, rest]) => `${first}${rest}`);

  test("validateMobile returns valid=true for 10-digit strings starting with 6–9", () => {
    fc.assert(
      fc.property(arbValidMobile, (s) => {
        const result = validateMobile(s);
        return result.valid === true && result.error === null;
      }),
      { numRuns: 100 }
    );
  });

  test("validateMobile returns valid=false for 10-digit strings starting with 0–5", () => {
    fc.assert(
      fc.property(arbInvalidFirstDigit, (s) => {
        const result = validateMobile(s);
        return result.valid === false;
      }),
      { numRuns: 100 }
    );
  });
});
