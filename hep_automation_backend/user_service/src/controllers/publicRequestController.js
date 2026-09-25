const axios = require("axios");
const EmailVerification = require("../models/EmailVerification");
const BulkPassParentRequest = require("../models/BulkPassParentRequest");
const { generateOTP, hashOTP } = require("../utils/otpUtils");
const { generateUploadToken } = require("../utils/tokenUtils");
// Links must be readable by the applicant portal, which decrypts with cryptoUtils.
const { encryptToken } = require("../utils/cryptoUtils");
const { verifyCaptcha } = require("../services/captchaService");
const { sanitizeInput } = require("../validations/publicRequestValidator");
const { pool } = require("../dbconfig/db");
const { BULK_PASS_LIMITS } = require("../constants/constants");

// The portal lives at FRONTEND_BASE_URL everywhere else in this module.
const FRONTEND_BASE = process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || "http://localhost:3000";

// A verified OTP is good for one submission and only for a while.
const VERIFICATION_MAX_AGE_MINUTES = 120;

/**
 * Human-readable tracking number: PBR-DDMMYY-XXXXXX. Unique by construction
 * (the column is unique); the caller retries on the rare collision.
 */
function makeTrackingNumber() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let suffix = "";
  for (let i = 0; i < 6; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `PBR-${dd}${mm}${yy}-${suffix}`;
}

/**
 * Who should hear about a new public request: every active General
 * Administration user. Falls back to ADMIN_EMAIL when none is configured.
 */
async function generalAdminEmails() {
  try {
    const result = await pool.query(
      `SELECT u.email
       FROM users u
       JOIN port_departments d ON d.id = u."departmentId"
       WHERE LOWER(d."departmentName") = 'general administration'
         AND u.status = 'active'
         AND u.email IS NOT NULL AND u.email <> ''`
    );
    const emails = result.rows.map((r) => r.email.trim()).filter(Boolean);
    if (emails.length) return emails;
  } catch (err) {
    console.warn("[PUBLIC-REQUEST] Could not look up General Administration users:", err.message);
  }
  return process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : [];
}

/**
 * Public Request Controller
 * 
 * Handles public-facing bulk pass request operations including:
 * - OTP request and verification for email validation
 * - Public request submission
 * 
 * Requirements: 22.1-22.5, 22.12-22.13
 */

/**
 * Request OTP for Email Verification
 * 
 * Generates a 6-digit OTP, hashes it with bcrypt, stores in database,
 * and sends via email service.
 * 
 * Rate Limiting (handled by middleware):
 * - 1 request per minute per email
 * - 5 requests per hour per email
 * 
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.12, 22.13
 * 
 * @route POST /api/bulk-pass/public/request-otp
 * @access Public
 */
exports.requestOTP = async (req, res) => {
  try {
    const { email, captchaToken, captchaAnswer } = req.body;

    // Validate email format
    if (!email || !EmailVerification.validateEmailFormat(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // The security code is checked here, where the OTP is actually sent. The
    // browser used to verify it separately and then call this endpoint with
    // nothing, which left the endpoint open to scripted use.
    if (!captchaToken || captchaAnswer === undefined || captchaAnswer === null || String(captchaAnswer).trim() === "") {
      return res.status(400).json({
        success: false,
        code: "CAPTCHA_REQUIRED",
        message: "Please enter the security code shown."
      });
    }
    const captchaOk = await verifyCaptcha(String(captchaToken), String(captchaAnswer).trim());
    if (!captchaOk) {
      return res.status(400).json({
        success: false,
        code: "CAPTCHA_INVALID",
        message: "Incorrect or expired security code. Please try the new code."
      });
    }

    console.log(`[PUBLIC-REQUEST] OTP request received for email: ${email}`);

    // Generate 6-digit OTP
    const otp = generateOTP();
    console.log(`[PUBLIC-REQUEST] Generated OTP for ${email}`);

    // Hash OTP using bcrypt
    const otpHash = await hashOTP(otp);
    console.log(`[PUBLIC-REQUEST] OTP hashed for ${email}`);

    // Calculate expiry (10 minutes from now)
    const expiresAt = EmailVerification.calculateExpiry();

    // Store in email_verifications table
    await EmailVerification.create({
      email: email,
      otp_hash: otpHash,
      expires_at: expiresAt,
      verified: false,
      attempts: 0
    });

    console.log(`[PUBLIC-REQUEST] OTP record created in database for ${email}`);

    // Send OTP via email service
    const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;
    
    if (!EMAIL_SERVICE_URL) {
      console.error("[PUBLIC-REQUEST] EMAIL_SERVICE_URL not configured");
      return res.status(500).json({
        success: false,
        message: "Email service is not available"
      });
    }

    try {
      await axios.post(
        `${EMAIL_SERVICE_URL}/api/email/sendOTP`,
        {
          email: email,
          otp: otp
        },
        {
          headers: { "x-service-name": "USER-SERVICE" },
          timeout: 8000
        }
      );

      console.log(`[PUBLIC-REQUEST] OTP email sent successfully to ${email}`);

      return res.status(200).json({
        success: true,
        message: "OTP sent to your email",
        expiresIn: 600 // 10 minutes in seconds
      });
    } catch (emailError) {
      console.error("[PUBLIC-REQUEST] Email service error:", emailError.message);

      // In development mode, log OTP to console so testing is never blocked by SMTP issues
      if (process.env.NODE_ENV === "development") {
        console.log(`\n==========================================\n[DEV MODE] OTP generated for ${email}: ${otp}\n==========================================\n`);
        return res.status(200).json({
          success: true,
          message: "OTP sent to your email (Dev Mode: Check console for OTP)",
          expiresIn: 600
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again later."
      });
    }
  } catch (error) {
    console.error("[PUBLIC-REQUEST] requestOTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * Verify OTP for Email Verification
 * 
 * Validates the OTP entered by the applicant against the hashed OTP
 * stored in the database. Checks for expiry (10 minutes) and maximum
 * attempts (3 attempts).
 * 
 * Requirements: 22.6, 22.7, 22.8, 22.9, 22.10
 * 
 * @route POST /api/bulk-pass/public/verify-otp
 * @access Public
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Validate request body
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    // Validate email format
    if (!EmailVerification.validateEmailFormat(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
      });
    }

    // Validate OTP format (must be 6 digits)
    const otpString = String(otp).trim();
    if (!/^\d{6}$/.test(otpString)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be a 6-digit number"
      });
    }

    console.log(`[PUBLIC-REQUEST] OTP verification request for email: ${email}`);

    // Retrieve latest unverified OTP record for email
    const verification = await EmailVerification.findLatestByEmail(email);

    if (!verification) {
      console.log(`[PUBLIC-REQUEST] No OTP record found for email: ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid or expired OTP"
      });
    }

    // Check if already verified
    if (verification.verified) {
      console.log(`[PUBLIC-REQUEST] OTP already verified for email: ${email}`);
      return res.status(200).json({
        success: true,
        verified: true,
        message: "Email already verified"
      });
    }

    // Check expiry (10 minutes)
    if (EmailVerification.isExpired(verification)) {
      console.log(`[PUBLIC-REQUEST] OTP expired for email: ${email}`);
      return res.status(401).json({
        success: false,
        message: "OTP has expired. Please request a new OTP."
      });
    }

    // Check attempts (max 3)
    if (verification.attempts >= 3) {
      console.log(`[PUBLIC-REQUEST] Max OTP attempts exceeded for email: ${email}`);
      return res.status(429).json({
        success: false,
        message: "Maximum verification attempts exceeded. Please request a new OTP."
      });
    }

    // Verify OTP using bcrypt.compare
    const isValid = await EmailVerification.verifyOTP(otpString, verification.otp_hash);

    if (!isValid) {
      // Increment attempts on failure
      await EmailVerification.incrementAttempts(verification.id);
      
      const remainingAttempts = 3 - (verification.attempts + 1);
      console.log(`[PUBLIC-REQUEST] Invalid OTP for email: ${email}. Remaining attempts: ${remainingAttempts}`);

      if (remainingAttempts <= 0) {
        return res.status(429).json({
          success: false,
          message: "Maximum verification attempts exceeded. Please request a new OTP."
        });
      }

      return res.status(401).json({
        success: false,
        message: `Invalid OTP. You have ${remainingAttempts} attempt(s) remaining.`
      });
    }

    // Mark as verified on success
    await EmailVerification.markVerified(verification.id);
    console.log(`[PUBLIC-REQUEST] Email verified successfully: ${email}`);

    // Return success response with verified: true
    return res.status(200).json({
      success: true,
      verified: true,
      message: "Email verified successfully"
    });

  } catch (error) {
    console.error("[PUBLIC-REQUEST] verifyOTP error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * Submit Public Bulk Pass Request
 * 
 * Creates a new public bulk pass request that requires General Administrator approval.
 * 
 * Validation:
 * - All fields validated via Joi/Zod schema (middleware)
 * - CAPTCHA verification
 * - Email verification status check
 * - Duplicate request check (same email & company within 24 hours)
 * - Text input sanitization for XSS prevention
 * 
 * Rate Limiting (handled by middleware):
 * - 1 request per 24 hours per email
 * - 5 requests per hour per IP address
 * 
 * Requirements: 21.1-21.15, 23.6-23.8, 24.1-24.7
 * 
 * @route POST /api/bulk-pass/public/request
 * @access Public
 */
exports.submitPublicRequest = async (req, res) => {
  try {
    // Extract validated data from middleware (publicRequestValidator)
    const validatedData = req.validatedData;

    console.log(`[PUBLIC-REQUEST] Submission received for email: ${validatedData.applicantEmail}`);

    // Step 1: CAPTCHA verification — SKIPPED at submission time.
    // The CAPTCHA was already verified during the OTP request step, and the
    // token is consumed (invalidated) after first use. Email verification via
    // OTP confirms the applicant already passed the CAPTCHA challenge.
    console.log(`[PUBLIC-REQUEST] CAPTCHA was verified during OTP step for ${validatedData.applicantEmail} — skipping re-verification`);

    // Step 2: Verify email is marked as verified
    // Requirement 21.11
    const emailVerification = await EmailVerification.findLatestByEmail(validatedData.applicantEmail);

    if (!emailVerification || !emailVerification.verified) {
      console.log(`[PUBLIC-REQUEST] Email not verified for ${validatedData.applicantEmail}`);
      return res.status(400).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Email must be verified before submitting a request."
      });
    }

    // A verification from long ago is not proof of who is sitting at the form now.
    const verifiedAgeMs = Date.now() - new Date(emailVerification.created_at).getTime();
    if (Number.isFinite(verifiedAgeMs) && verifiedAgeMs > VERIFICATION_MAX_AGE_MINUTES * 60 * 1000) {
      console.log(`[PUBLIC-REQUEST] Email verification too old for ${validatedData.applicantEmail}`);
      return res.status(400).json({
        success: false,
        code: "EMAIL_VERIFICATION_EXPIRED",
        message: "Your email verification has expired. Please verify your email again."
      });
    }

    console.log(`[PUBLIC-REQUEST] Email verification confirmed for ${validatedData.applicantEmail}`);

    // Step 3: Check submission rate limit within 24 hours
    // Requirement 21.10 (Prevent excessive submissions — max 10 per 24h per email)
    const MAX_SUBMISSIONS_PER_DAY = 10;
    const hasDuplicate = await BulkPassParentRequest.hasDuplicateRequest(
      validatedData.applicantEmail,
      validatedData.companyName,
      24,
      MAX_SUBMISSIONS_PER_DAY
    );

    if (hasDuplicate) {
      console.log(`[PUBLIC-REQUEST] Rate limit reached for ${validatedData.applicantEmail} (max ${MAX_SUBMISSIONS_PER_DAY}/24h)`);
      return res.status(403).json({
        success: false,
        message: `You have reached the maximum of ${MAX_SUBMISSIONS_PER_DAY} submissions per 24 hours from this email address. Please wait before submitting another request.`
      });
    }

    // Step 4: Sanitize all text inputs (already done by validator, but double-check critical fields)
    // Requirement 21.15
    const sanitizedData = {
      company_name: sanitizeInput(validatedData.companyName),
      applicant_email: validatedData.applicantEmail.toLowerCase(),
      applicant_mobile: validatedData.applicantMobile,
      visitor_type: validatedData.visitorType,
      no_of_persons: validatedData.noOfPersons,
      no_of_vehicles: validatedData.noOfVehicles,
      payment_mode: validatedData.paymentMode || null,
      purpose: validatedData.purpose ? sanitizeInput(validatedData.purpose) : null,
      validity_from: validatedData.validityFrom || null,
      validity_upto: validatedData.validityUpto,
      work_order_required: validatedData.workOrderRequired || false,
      ref_doc_no: validatedData.refDocNo ? sanitizeInput(validatedData.refDocNo) : null,
      remarks: validatedData.remarks ? sanitizeInput(validatedData.remarks) : null
    };

    // Step 5: Generate a readable tracking number (PBR-DDMMYY-XXXXXX), retrying
    // on the rare collision.
    let trackingNumber = makeTrackingNumber();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await BulkPassParentRequest.findByTrackingNumber(trackingNumber);
      if (!clash) break;
      trackingNumber = makeTrackingNumber();
    }

    console.log(`[PUBLIC-REQUEST] Generated tracking number: ${trackingNumber}`);

    // Step 6: Create record first with a temporary placeholder token,
    // then generate the real JWT-based token using the actual parent request ID.
    // (generateUploadToken rejects batchId=0 because !0===true in JS.)
    const crypto = require("crypto");
    const placeholderToken = crypto.randomBytes(16).toString("hex");

    // Step 7: Create record in bulk_pass_parent_requests
    // Requirements: 21.10, 24.1, 24.2
    const parentRequestData = {
      tracking_number: trackingNumber,
      shared_token: placeholderToken, // Temporary — will be replaced below
      ...sanitizedData,
      token_active: false, // Will be enabled on approval (Requirement 21.14)
      status: 'PENDING_ADMIN_APPROVAL' // Requirement 21.10
    };

    const parentRequest = await BulkPassParentRequest.create(parentRequestData);

    console.log(`[PUBLIC-REQUEST] Parent request created with ID: ${parentRequest.id}`);

    // Step 7b: Store the raw upload token (links carry its encrypted form —
    // the same convention as bulk_pass_batches). Approval re-issues it anyway.
    try {
      const realToken = generateUploadToken(parentRequest.id, 'PUBLIC_WEBSITE');
      await BulkPassParentRequest.update(parentRequest.id, { shared_token: realToken });
      parentRequest.shared_token = realToken;
    } catch (tokenError) {
      // Non-fatal: the request was created successfully, token is regenerated on approval
      console.warn(`[PUBLIC-REQUEST] Failed to generate token for request ${parentRequest.id}:`, tokenError.message);
    }

    // Step 7c: The verification has done its job; the next request must verify again.
    try {
      await EmailVerification.consumeForEmail(sanitizedData.applicant_email);
    } catch (consumeErr) {
      console.warn("[PUBLIC-REQUEST] Could not clear email verification:", consumeErr.message);
    }

    // Step 8: Send acknowledgment email to applicant
    // Requirements: 24.2, 24.5
    const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;

    if (EMAIL_SERVICE_URL) {
      try {
        await axios.post(
          `${EMAIL_SERVICE_URL}/api/email/sendPublicRequestAcknowledgment`,
          {
            // email_service reads the recipient from applicantEmail.
            applicantEmail: sanitizedData.applicant_email,
            email: sanitizedData.applicant_email,
            trackingNumber: trackingNumber,
            companyName: sanitizedData.company_name,
            submissionTimestamp: parentRequest.created_at,
            submittedAt: parentRequest.created_at
          },
          {
            headers: { "x-service-name": "USER-SERVICE" },
            timeout: 8000
          }
        );

        console.log(`[PUBLIC-REQUEST] Acknowledgment email sent to ${sanitizedData.applicant_email}`);
      } catch (emailError) {
        console.error("[PUBLIC-REQUEST] Failed to send acknowledgment email:", emailError.message);
        // Continue execution - email failure should not block request creation
      }
    } else {
      console.warn("[PUBLIC-REQUEST] EMAIL_SERVICE_URL not configured - skipping acknowledgment email");
    }

    // Step 9: Send notification email to General Admin
    // Requirements: 24.3, 24.4
    if (EMAIL_SERVICE_URL) {
      try {
        const adminEmails = await generalAdminEmails();
        if (!adminEmails.length) {
          console.warn("[PUBLIC-REQUEST] No General Administration recipients found; admin notification skipped");
        } else await axios.post(
          `${EMAIL_SERVICE_URL}/api/email/sendAdminNotification`,
          {
            requestId: parentRequest.id,
            trackingNumber: trackingNumber,
            companyName: sanitizedData.company_name,
            applicantEmail: sanitizedData.applicant_email,
            applicantMobile: sanitizedData.applicant_mobile,
            visitorType: sanitizedData.visitor_type,
            noOfPersons: sanitizedData.no_of_persons,
            noOfVehicles: sanitizedData.no_of_vehicles,
            validityFrom: sanitizedData.validity_from,
            validityUpto: sanitizedData.validity_upto,
            purpose: sanitizedData.purpose,
            submissionTimestamp: parentRequest.created_at,
            // Field names the email template actually reads.
            requestDetailLink: `${FRONTEND_BASE}/admin/public-requests/${parentRequest.id}`,
            detailLink: `${FRONTEND_BASE}/admin/public-requests/${parentRequest.id}`,
            adminEmail: adminEmails.join(", "),
            adminEmails
          },
          {
            headers: { "x-service-name": "USER-SERVICE" },
            timeout: 8000
          }
        );

        console.log(`[PUBLIC-REQUEST] Admin notification email sent for request ${parentRequest.id}`);
      } catch (emailError) {
        console.error("[PUBLIC-REQUEST] Failed to send admin notification email:", emailError.message);
        // Continue execution - email failure should not block request creation
      }
    }

    // Step 10: Return success response
    // Requirement 24.1
    return res.status(201).json({
      success: true,
      message: "Request submitted successfully. You will receive approval status via email within 2-3 business days.",
      trackingNumber: trackingNumber,
      requestId: parentRequest.id,
      submittedAt: parentRequest.created_at
    });

  } catch (error) {
    console.error("[PUBLIC-REQUEST] submitPublicRequest error:", error);

    // Handle specific error cases
    if (error.message && error.message.includes("duplicate")) {
      return res.status(403).json({
        success: false,
        message: "A request with these details already exists."
      });
    }

    if (error.message && error.message.includes("validation")) {
      return res.status(400).json({
        success: false,
        message: "Validation error. Please check your input and try again."
      });
    }

    return res.status(500).json({
      success: false,
      message: "We could not submit your request right now. Please try again in a few minutes."
    });
  }
};

/**
 * Check the status of a public request
 *
 * The applicant quotes the tracking number from their acknowledgment email
 * together with the email address they applied with; both must match. Once
 * the request is approved the upload link is returned too, so a lost approval
 * email is not a dead end.
 *
 * @route GET /api/bulk-pass/public/request-status?trackingNumber=...&email=...
 * @access Public
 */
exports.getRequestStatus = async (req, res) => {
  try {
    const trackingNumber = String(req.query.trackingNumber || "").trim().toUpperCase();
    const email = String(req.query.email || "").trim().toLowerCase();

    if (!trackingNumber || !email || !EmailVerification.validateEmailFormat(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide the tracking number and the email address you applied with."
      });
    }

    const request = await BulkPassParentRequest.findByTrackingNumber(trackingNumber);
    // One answer for "no such request" and "wrong email", so the endpoint
    // cannot be used to confirm which tracking numbers exist.
    if (!request || String(request.applicant_email || "").toLowerCase() !== email) {
      return res.status(404).json({
        success: false,
        message: "No request was found for that tracking number and email address."
      });
    }

    const isActive = request.status === "ACTIVE";
    const uploadLink =
      isActive && request.token_active && request.shared_token
        ? `${FRONTEND_BASE}/bulk_pass/${encryptToken(request.shared_token)}`
        : null;

    return res.status(200).json({
      success: true,
      data: {
        trackingNumber: request.tracking_number,
        companyName: request.company_name,
        status: request.status,
        submittedAt: request.created_at,
        approvedAt: request.approved_at || null,
        rejectedAt: request.rejected_at || null,
        rejectionReason: request.status === "REJECTED_BY_ADMIN" ? request.rejection_reason || null : null,
        validityFrom: request.approved_time_from || request.validity_from || null,
        validityUpto: request.approved_time_upto || request.validity_upto || null,
        maxTotalPersons: request.no_of_persons,
        maxTotalVehicles: request.no_of_vehicles,
        perBatchMaxPersons: BULK_PASS_LIMITS.MAX_PERSONS_PER_BATCH,
        perBatchMaxVehicles: BULK_PASS_LIMITS.MAX_VEHICLES_PER_BATCH,
        uploadLink,
      }
    });
  } catch (error) {
    console.error("[PUBLIC-REQUEST] getRequestStatus error:", error);
    return res.status(500).json({ success: false, message: "Could not check the request status right now." });
  }
};
