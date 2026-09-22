const express = require("express");
const router = express.Router();

const controller = require("../controllers/faceCaptureController");
const verifyToken = require("../middlewares/verifyToken");
const { upload } = require("../middlewares/uploadMiddleware");
const { uploadLimiter } = require("../middlewares/rateLimiter");

/*
 * Three separate capabilities, and none can do another's job.
 *
 *   the portal      — a signed-in agent, creates and cancels links
 *   the applicant   — holds the token in the link; can open it and upload once
 *   the screen      — holds the subscriber token; can only watch and read
 *
 * A link forwarded to the wrong person therefore cannot be used to watch
 * somebody else's application, and a leaked subscriber token cannot upload.
 */

// --- the portal ---
router.post("/sessions", verifyToken, controller.createSession);
router.post("/sessions/:id/cancel", verifyToken, controller.cancelSession);
router.post("/sessions/:id/email", verifyToken, controller.emailSession);

// --- the watching screen (authorised by the subscriber token itself) ---
router.get("/sessions/:id", controller.getSession);
router.get("/sessions/:id/stream", controller.streamSession);
router.get("/photos/:sessionId", controller.getPhoto);

// --- the applicant ---
router.get("/capture/:token", controller.openCapture);
router.post(
  "/capture/:token/photo",
  uploadLimiter,
  upload.single("photo"),
  controller.submitPhoto
);

// --- passenger identification (Smart Thin-Client) ---
router.get("/passenger/view", controller.passengerView);
router.post(
  "/passenger/identify",
  uploadLimiter,
  upload.single("photo"),
  controller.passengerIdentify
);
router.get("/passenger/stats", controller.passengerStats);
router.post("/passenger/enroll", uploadLimiter, upload.single("photo"), controller.passengerEnroll);
router.post("/passenger/sync-gallery", controller.passengerSync);
router.get("/passenger/test-sample", controller.passengerTestSample);
router.get("/passenger/sample-image", controller.passengerSampleImage);

module.exports = router;


