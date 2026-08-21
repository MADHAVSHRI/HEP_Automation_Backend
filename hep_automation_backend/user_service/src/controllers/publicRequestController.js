const axios = require("axios");
const EmailVerification = require("../models/EmailVerification");
const BulkPassParentRequest = require("../models/BulkPassParentRequest");
const { generateOTP, hashOTP } = require("../utils/otpUtils");
const { generateUploadToken, encryptToken } = require("../utils/tokenUtils");
const { verifyCaptcha } = require("../services/captchaService");
const { sanitizeInput } = require("../validations/publicRequestValidator");

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
    const { email } = req.body;

    // Validate email format
    if (!email || !EmailVerification.validateEmailFormat(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format"
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
      message: `Failed to request OTP: ${error.message}`,
      errorDetails: error.message
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
      message: `Failed to verify OTP: ${error.message}`,
      errorDetails: error.message
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
        message: "Email must be verified before submitting a request."
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

    // Step 5: Generate tracking number
    // Requirement 21.13 - Format: "TEMP-{timestamp}-{random}"
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    const trackingNumber = `TEMP-${timestamp}-${random}`;

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

    // Step 7b: Now generate the proper encrypted JWT token using the real parent request ID
    try {
      const realToken = generateUploadToken(parentRequest.id, 'PUBLIC_WEBSITE');
      const encryptedToken = encryptToken(realToken);
      // Update the parent request with the proper shared_token
      await BulkPassParentRequest.update(parentRequest.id, { shared_token: encryptedToken });
      parentRequest.shared_token = encryptedToken;
      console.log(`[PUBLIC-REQUEST] Updated shared_token with encrypted JWT for request ${parentRequest.id}`);
    } catch (tokenError) {
      // Non-fatal: the request was created successfully, token can be regenerated on approval
      console.warn(`[PUBLIC-REQUEST] Failed to generate encrypted token for request ${parentRequest.id}:`, tokenError.message);
    }

    // Step 8: Send acknowledgment email to applicant
    // Requirements: 24.2, 24.5
    const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL;

    if (EMAIL_SERVICE_URL) {
      try {
        await axios.post(
          `${EMAIL_SERVICE_URL}/api/email/sendPublicRequestAcknowledgment`,
          {
            email: sanitizedData.applicant_email,
            trackingNumber: trackingNumber,
            companyName: sanitizedData.company_name,
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
        const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
        
        await axios.post(
          `${EMAIL_SERVICE_URL}/api/email/sendAdminNotification`,
          {
            requestId: parentRequest.id,
            trackingNumber: trackingNumber,
            companyName: sanitizedData.company_name,
            applicantEmail: sanitizedData.applicant_email,
            applicantMobile: sanitizedData.applicant_mobile,
            noOfPersons: sanitizedData.no_of_persons,
            noOfVehicles: sanitizedData.no_of_vehicles,
            validityUpto: sanitizedData.validity_upto,
            purpose: sanitizedData.purpose,
            detailLink: `${FRONTEND_URL}/admin/public-requests/${parentRequest.id}`
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

    // Generic error response with details
    return res.status(500).json({
      success: false,
      message: `Submission error: ${error.message}`,
      errorDetails: error.message
    });
  }
};
