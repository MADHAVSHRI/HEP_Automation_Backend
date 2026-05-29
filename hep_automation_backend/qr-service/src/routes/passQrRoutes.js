const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const passQrController = require("../controllers/passQrController");

router.get(
  "/generate-pass/:passRequestId",
  verifyToken,
  passQrController.generatePassQR
);

router.post(
  "/validate",
  passQrController.validateQr
);

// Vendor pass QR generation (public route - no auth needed) 
router.get("/vendor-generate-qr/:vendorPassId", passQrController.generateVendorQr);

// Single entity vendor pass QR generation (public route - no auth needed)
router.get("/vendor-generate-single-qr/:vendorPassId/:entityType/:entityIndex", passQrController.generateVendorSingleQr);

module.exports = router;