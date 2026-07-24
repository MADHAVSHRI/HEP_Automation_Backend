const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const passQrController = require("../controllers/passQrController");

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

router.post(
  "/validate",
  passQrController.validateQr
);

// Vendor pass QR generation (public route - no auth needed) 
router.get("/vendor-generate-qr/:vendorPassId", passQrController.generateVendorQr);

// Single entity vendor pass QR generation (public route - no auth needed)
router.get("/vendor-generate-single-qr/:vendorPassId/:entityType/:entityIndex", passQrController.generateVendorSingleQr);

// ── Bulk Pass QR routes ──────────────────────────────────────────────────────
// Internal: generate + store QR PDF (returns PDF + X-Pdf-Path header)
router.post("/bulk-pass/:batchId", passQrController.generateBulkQr);
// Public: inline PDF viewer for an approved (COMPLETED) bulk pass
router.get("/bulk-pass-view/:batchId", passQrController.viewBulkPass);

module.exports = router;