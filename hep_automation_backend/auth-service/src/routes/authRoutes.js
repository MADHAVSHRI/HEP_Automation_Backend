const express = require("express");

const router = express.Router();

const loginController = require("../controllers/loginController");

const verifyToken = require("../middlewares/verifyToken");
// VAPT fix: Vuln #8 – apply rate limiting on forgot-password to prevent OTP flooding
const forgotPasswordLimiter = require("../middlewares/forgotPasswordLimiter");

router.post("/login", loginController.login);
router.post("/refresh", loginController.refreshToken);
router.post("/logout", verifyToken, loginController.logout);

// Heartbeat: frontend calls this every 60 s to slide the Redis TTL forward.
// When the tab closes, heartbeats stop and Redis auto-expires the session.
router.post("/heartbeat", verifyToken, loginController.heartbeat);

// Called by navigator.sendBeacon on tab/browser close — no Authorization header possible
router.post("/beacon-logout", loginController.beaconLogout);

// Rate-limited: 5 requests per 15-minute window per IP (VAPT Vuln #8)
router.post("/forgot-password", forgotPasswordLimiter, loginController.forgotPassword);
router.post("/verify-otp", loginController.verifyOtp);
router.post("/reset-password", loginController.resetPassword);

module.exports = router;