const express = require("express");
const router = express.Router();

const captchaController = require("../controllers/captchaController");
const { captchaRateLimiter } = require("../middlewares/rateLimitMiddleware");

/**
 * CAPTCHA Routes
 * 
 * Provides public endpoints for CAPTCHA generation and verification
 * for the public bulk pass request form.
 * 
 * Both routes are public (no authentication required).
 * 
 * Requirements: 23.1, 23.6, 23.11
 */

/**
 * @route   GET /api/captcha/get-captcha
 * @desc    Generate a new math-based CAPTCHA challenge
 * @access  Public
 * @returns {Object} { question, token, expiresIn }
 * 
 * Example Response:
 * {
 *   "question": "What is 7 + 5?",
 *   "token": "550e8400-e29b-41d4-a716-446655440000",
 *   "expiresIn": 120
 * }
 * 
 * Requirement 23.1: Display a math-based CAPTCHA challenge when applicant accesses public form
 */
router.get("/get-captcha", captchaController.getCaptcha);

/**
 * @route   POST /api/captcha/verify-captcha
 * @desc    Verify the user's CAPTCHA answer
 * @access  Public
 * @middleware captchaRateLimiter - Rate limit: 10 failed attempts per IP per 15 minutes
 * 
 * Request Body:
 * {
 *   "token": "550e8400-e29b-41d4-a716-446655440000",
 *   "answer": "12"
 * }
 * 
 * Success Response (200):
 * {
 *   "success": true,
 *   "valid": true
 * }
 * 
 * Error Response (401):
 * {
 *   "success": false,
 *   "valid": false,
 *   "message": "Invalid or expired CAPTCHA"
 * }
 * 
 * Rate Limit Response (429):
 * {
 *   "success": false,
 *   "message": "Too many failed CAPTCHA attempts. Your IP has been blocked for 1 hour.",
 *   "retryAfter": 3600
 * }
 * 
 * Requirements:
 * - 23.6: Require the Applicant to enter the numeric answer to the math question
 * - 23.11: Enforce rate limiting of 10 failed CAPTCHA attempts per IP address
 */
router.post("/verify-captcha", captchaRateLimiter, captchaController.verifyCaptcha);

module.exports = router;
