const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
// Security fix C-03, C-08, C-11: service-to-service auth for internal/vendor routes
const verifyService = require("../middlewares/verifyService");
const passQrController = require("../controllers/passQrController");

// ── User-facing: require JWT from authenticated portal user ─────────────────
router.get(
  "/generate-pass/:passRequestId",
  verifyToken,
  passQrController.generatePassQR
);

router.get(
  "/generate-material-pass/:passRequestId",
  verifyToken,
  passQrController.generateMaterialPassQr
);

// QR validation — public (called from gate scanner app, no user session)
router.post(
  "/validate",
  passQrController.validateQr
);

// ── Vendor pass QR generation ───────────────────────────────────────────────
router.get(
  "/vendor-generate-qr/:vendorPassId",
  passQrController.generateVendorQr
);

router.get(
  "/vendor-generate-single-qr/:vendorPassId/:entityType/:entityIndex",
  passQrController.generateVendorSingleQr
);

// ── Bulk Pass QR routes ─────────────────────────────────────────────────────
// Fix C-11: was unauthenticated — now requires service key (called by approval-admin).
router.post(
  "/bulk-pass/:batchId",
  verifyService,
  passQrController.generateBulkQr
);

// Public: inline PDF viewer for an approved (COMPLETED) bulk pass.
// Intentionally public — anyone with the link can view their approved pass.
router.get("/bulk-pass-view/:batchId", passQrController.viewBulkPass);

// VVIP Pass QR PDF generation (internal — called by approval-admin-service)
router.post(
  "/vvip-pass/:requestId",
  verifyService,
  passQrController.generateVvipQr
);

module.exports = router;
