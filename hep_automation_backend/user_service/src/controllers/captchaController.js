// const captchaService = require("../services/captchaService");

// exports.getCaptcha = async (req, res) => {

//   try {

//     const captcha = await captchaService.createCaptcha();

//     res.status(200).json({
//       success: true,
//       captchaSvg: captcha.captchaSvg,
//       captchaToken: captcha.captchaToken,
//       expiresIn: captcha.expiresIn
//     });

//   } catch (error) {

//     console.error("Captcha generation error:", error);

//     res.status(500).json({
//       success: false,
//       message: "Captcha generation failed"
//     });

//   }

// };

// exports.verifyCaptcha = async (req, res) => {
//   try {
//     const { token, value } = req.body;

//     if (!token || !value) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Token and value required" });
//     }

//     const isValid = await captchaService.verifyCaptcha(token, value);

//     if (!isValid) {
//       return res
//         .status(400)
//         .json({ success: false, message: "Invalid or expired captcha" });
//     }

//     return res.status(200).json({ success: true, message: "Captcha valid" });
//   } catch (error) {
//     console.error("Captcha verification error:", error);
//     return res
//       .status(500)
//       .json({ success: false, message: "Verification failed" });
//   }
// };

const captchaService = require("../services/captchaService");

/**
 * CAPTCHA Controller
 * 
 * Handles CAPTCHA generation and verification for public bulk pass requests
 * 
 * Requirements: 23.1-23.5
 */

/**
 * Get CAPTCHA Challenge
 * 
 * Generates a math-based CAPTCHA question, stores the answer in Redis,
 * and returns the question and token to the client.
 * 
 * Requirements:
 * - 23.1: Display a math-based CAPTCHA challenge
 * - 23.2: Generate simple arithmetic questions (X + Y or X - Y with single-digit integers)
 * - 23.3: Generate a unique UUID token for each CAPTCHA challenge
 * - 23.4: Store the correct answer in Redis with the UUID token as the key
 * - 23.5: Set the CAPTCHA expiry to 120 seconds
 * 
 * @route GET /api/captcha/get-captcha
 * @access Public
 */
exports.getCaptcha = async (req, res) => {
  try {
    console.log('[CAPTCHA] Generating new CAPTCHA challenge');

    // Generate CAPTCHA (question, token, answer, expiresIn)
    const captcha = captchaService.generateCaptcha();

    console.log(`[CAPTCHA] Generated question: "${captcha.question}" with token: ${captcha.token}`);

    // Store answer in Redis with 120-second TTL
    await captchaService.storeCaptchaAnswer(captcha.token, captcha.answer);

    console.log(`[CAPTCHA] Answer stored in Redis with token: ${captcha.token}`);

    // Return question and token to client (NOT the answer!)
    res.status(200).json({
      success: true,
      question: captcha.question,
      captchaQuestion: captcha.question,
      token: captcha.token,
      captchaToken: captcha.token,
      expiresIn: captcha.expiresIn
    });

    console.log('[CAPTCHA] CAPTCHA challenge sent to client');
  } catch (error) {
    console.error("[CAPTCHA] CAPTCHA generation error:", error);

    res.status(500).json({
      success: false,
      message: "CAPTCHA generation failed"
    });
  }
};

/**
 * Verify CAPTCHA Answer
 * 
 * Validates the user's answer against the stored value in Redis.
 * Deletes the token after verification to enforce one-time use.
 * Records failures in rate limiter to prevent abuse.
 * 
 * Requirements:
 * - 23.6: Require the Applicant to enter the numeric answer
 * - 23.7: Validate the CAPTCHA answer against the stored value using the UUID token
 * - 23.8: Reject form submission if CAPTCHA is incorrect or expired
 * - 23.9: Delete the CAPTCHA token from Redis after verification attempt
 * - 23.10: Provide a "Refresh CAPTCHA" button to generate a new challenge
 * - 23.11: Enforce rate limiting of 10 failed CAPTCHA attempts per IP address
 * 
 * @route POST /api/captcha/verify-captcha
 * @access Public
 * @middleware captchaRateLimiter - Applied via routes
 */
exports.verifyCaptcha = async (req, res) => {
  try {
    // Accept both `answer` and `value` for backward compatibility
    // (the auth-service login controller sends `value`, public form sends `answer`)
    const { token, answer, value } = req.body;
    const captchaAnswer = answer !== undefined ? answer : value;

    // Validate request body (Requirement 23.6)
    if (!token || captchaAnswer === undefined || captchaAnswer === null) {
      return res.status(400).json({
        success: false,
        message: "Token and answer are required"
      });
    }

    console.log(`[CAPTCHA] Verifying CAPTCHA with token: ${token}`);

    // Get IP address for failure tracking
    const ipAddress = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for']?.split(',')[0];

    // Verify CAPTCHA (also deletes token from Redis - Requirement 23.9)
    const isValid = await captchaService.verifyCaptcha(token, captchaAnswer);

    if (!isValid) {
      console.log(`[CAPTCHA] Invalid or expired CAPTCHA for token: ${token} from IP: ${ipAddress}`);
      
      // Record failure in rate limiter (Requirement 23.11)
      const { recordCAPTCHAFailure } = require("../middlewares/rateLimitMiddleware");
      await recordCAPTCHAFailure(ipAddress);
      
      // Return 401 Unauthorized for incorrect/expired CAPTCHA (Requirement 23.8)
      return res.status(401).json({
        success: false,
        valid: false,
        message: "Invalid or expired CAPTCHA"
      });
    }

    console.log(`[CAPTCHA] CAPTCHA verified successfully for token: ${token}`);

    // Return success response with both success and valid fields
    return res.status(200).json({
      success: true,
      valid: true
    });
  } catch (error) {
    console.error("[CAPTCHA] CAPTCHA verification error:", error);

    return res.status(500).json({
      success: false,
      message: "CAPTCHA verification failed"
    });
  }
};
