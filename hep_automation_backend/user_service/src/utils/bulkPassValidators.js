/**
 * Validation utilities for Bulk Pass intake and Excel row fields.
 *
 * Each validator returns { valid: boolean, error: string | null }.
 *
 * Requirements: 1.4, 1.5, 1.6, 1.7, 1.8, 5.3, 5.5, 5.6, 5.7
 */

/**
 * Validates an applicant email address.
 * Accepts any string matching [^\s@]+@[^\s@]+\.[^\s@]+
 * Requirements: 1.4
 *
 * @param {string} s
 * @returns {{ valid: boolean, error: string | null }}
 */
function validateEmail(s) {
  if (typeof s !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
    return { valid: false, error: "Invalid applicant email" };
  }
  return { valid: true, error: null };
}

/**
 * Validates an applicant or visitor mobile number.
 * Must be exactly 10 digits starting with 6, 7, 8, or 9.
 * Requirements: 1.5, 5.6
 *
 * @param {string} s
 * @returns {{ valid: boolean, error: string | null }}
 */
function validateMobile(s) {
  if (typeof s !== "string" || !/^[6-9][0-9]{9}$/.test(s)) {
    return {
      valid: false,
      error: "Invalid mobile number: must be 10 digits starting with 6–9",
    };
  }
  return { valid: true, error: null };
}

/**
 * Validates an Aadhaar number.
 * Must be exactly 12 numeric digits (no spaces).
 * Requirements: 5.3
 *
 * @param {string} s
 * @returns {{ valid: boolean, error: string | null }}
 */
function validateAadhaar(s) {
  if (typeof s !== "string" || !/^\d{12}$/.test(s)) {
    return {
      valid: false,
      error: "Invalid Aadhaar: must be exactly 12 digits",
    };
  }
  return { valid: true, error: null };
}

/**
 * Validates a Date of Birth string.
 * Accepts DD/MM/YYYY format. Rejects unparseable dates and future dates.
 * Requirements: 5.5
 *
 * @param {string} s
 * @returns {{ valid: boolean, error: string | null }}
 */
function validateDOB(s) {
  if (typeof s !== "string") {
    return { valid: false, error: 'Invalid DOB: use DD/MM/YYYY format' };
  }

  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!match) {
    return { valid: false, error: "Invalid DOB: use DD/MM/YYYY format" };
  }

  const [, dd, mm, yyyy] = match;
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10) - 1; // 0-based
  const year = parseInt(yyyy, 10);

  const date = new Date(year, month, day);

  // Verify the date components are valid (e.g. no 31st in April)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return { valid: false, error: "Invalid DOB: use DD/MM/YYYY format" };
  }

  // Reject future dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) {
    return { valid: false, error: "Invalid DOB: future date not allowed" };
  }

  return { valid: true, error: null };
}

/**
 * Validates a vehicle registration number.
 * Pattern: ^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$ (case-insensitive)
 * Requirements: 5.7
 *
 * @param {string} s
 * @returns {{ valid: boolean, error: string | null }}
 */
function validateVehicleNumber(s) {
  if (typeof s !== "string" || !/^[A-Za-z]{2}[0-9]{1,2}[A-Za-z]{1,3}[0-9]{4}$/.test(s)) {
    return { valid: false, error: "Invalid vehicle number format" };
  }
  return { valid: true, error: null };
}

module.exports = {
  validateEmail,
  validateMobile,
  validateAadhaar,
  validateDOB,
  validateVehicleNumber,
};
