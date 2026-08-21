/**
 * publicRequestRoutes.js
 *
 * Public request API routes for bulk pass public request workflow.
 * These routes handle the public-facing request submission process including:
 * - Email verification via OTP
 * - Public bulk pass request submission
 *
 * All routes are public (no authentication required).
 * Appropriate middleware applied: rate limiting, validation, sanitization.
 *
 * Requirements: 22.1, 22.6, 21.1
 */

const express = require("express");
const router = express.Router();

// Controller imports
const publicRequestController = require("../controllers/publicRequestController");

// Middleware imports
const { otpRateLimiter, publicRequestRateLimiter } = require("../middlewares/rateLimitMiddleware");
const { validatePublicRequest } = require("../validations/publicRequestValidator");

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC ROUTES (No Authentication Required)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Request OTP for Email Verification
 * 
 * POST /api/bulk-pass/public/request-otp
 * 
 * Generates a 6-digit OTP, hashes it with bcrypt, stores in database,
 * and sends via email service.
 * 
 * Rate Limiting:
 * - 1 request per minute per email
 * - 5 requests per hour per email
 * - 20 requests per hour per IP
 * 
 * Request Body:
 * {
 *   "email": "applicant@example.com"
 * }
 * 
 * Response (200 OK):
 * {
 *   "success": true,
 *   "message": "OTP sent to your email",
 *   "expiresIn": 600
 * }
 * 
 * Error Responses:
 * - 400 Bad Request: Invalid email format
 * - 429 Too Many Requests: Rate limit exceeded
 * - 500 Internal Server Error: Email service failure
 * 
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.12, 22.13
 */
router.post(
  "/request-otp",
  otpRateLimiter,
  publicRequestController.requestOTP
);

/**
 * Verify Email OTP
 * 
 * POST /api/bulk-pass/public/verify-otp
 * 
 * Validates the OTP entered by the applicant against the hashed OTP
 * stored in the database. Checks for expiry (10 minutes) and maximum
 * attempts (3 attempts).
 * 
 * Request Body:
 * {
 *   "email": "applicant@example.com",
 *   "otp": "123456"
 * }
 * 
 * Response (200 OK):
 * {
 *   "success": true,
 *   "verified": true,
 *   "message": "Email verified successfully"
 * }
 * 
 * Error Responses:
 * - 400 Bad Request: Invalid OTP format
 * - 401 Unauthorized: OTP mismatch or expired
 * - 429 Too Many Requests: Too many failed attempts
 * 
 * Requirements: 22.6, 22.7, 22.8, 22.9, 22.10
 */
router.post(
  "/verify-otp",
  publicRequestController.verifyOTP
);

/**
 * Submit Public Bulk Pass Request
 * 
 * POST /api/bulk-pass/public/request
 * 
 * Creates a new public bulk pass request that requires General Administrator approval.
 * 
 * Validation:
 * - All fields validated via Zod schema (validatePublicRequest middleware)
 * - CAPTCHA verification
 * - Email verification status check
 * - Duplicate request check (same email & company within 24 hours)
 * - Text input sanitization for XSS prevention
 * 
 * Rate Limiting:
 * - 1 request per 24 hours per email
 * - 5 requests per hour per IP address
 * 
 * Request Body:
 * {
 *   "companyName": "ABC Productions Pvt Ltd",
 *   "applicantEmail": "contact@abcproductions.com",
 *   "applicantMobile": "9876543210",
 *   "visitorType": "VENDOR",
 *   "noOfPersons": 25,
 *   "noOfVehicles": 5,
 *   "validityFrom": "2026-01-01",
 *   "validityUpto": "2026-12-31",
 *   "paymentMode": "CASH",
 *   "purpose": "Film shooting crew passes",
 *   "workOrderRequired": true,
 *   "refDocNo": "WO/2026/1234",
 *   "remarks": "Required for 3-month film production",
 *   "captchaToken": "550e8400-e29b-41d4-a716-446655440000",
 *   "captchaAnswer": "12",
 *   "emailVerified": true
 * }
 * 
 * Response (201 Created):
 * {
 *   "success": true,
 *   "message": "Request submitted successfully. You will receive approval status via email within 2-3 business days.",
 *   "trackingNumber": "TEMP-1704067200-ABC123",
 *   "requestId": 42,
 *   "submittedAt": "2026-01-20T09:15:00Z"
 * }
 * 
 * Error Responses:
 * - 400 Bad Request: Validation failed, CAPTCHA invalid, email not verified
 * - 403 Forbidden: Duplicate request within 24 hours
 * - 429 Too Many Requests: Rate limit exceeded
 * - 500 Internal Server Error: Database or email service failure
 * 
 * Requirements: 21.1-21.15, 23.6-23.8, 24.1-24.7
 */
router.post(
  "/request",
  validatePublicRequest,
  publicRequestRateLimiter,
  publicRequestController.submitPublicRequest
);

module.exports = router;
