const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const upload = require("../middlewares/uploadMiddleware");
const vendorPassController = require("../controllers/vendorPassController");

/**
 * Public token endpoint — declared FIRST so it does not pass through
 * verifyToken. The vendor email link must work without authentication.
 */
router.get("/visitor-types", verifyToken, vendorPassController.getVisitorTypes);
router.get("/public/:token", vendorPassController.getPublicByToken);
router.post(
  "/public/:token/submit",
  upload.fields([
    { name: "personPhoto", maxCount: 50 },
    { name: "personAadhar", maxCount: 50 },
    { name: "personIdProof", maxCount: 50 },
    { name: "driverLicense", maxCount: 50 },
    { name: "requisitionLetter", maxCount: 50 },
    { name: "policeVerification", maxCount: 50 },
    { name: "employmentProof", maxCount: 50 },
    { name: "chaLicenseCopy", maxCount: 50 },
    { name: "passportDoc", maxCount: 50 },
    { name: "vehicleRC", maxCount: 50 },
    { name: "vehicleInsurance", maxCount: 50 },
    { name: "vehiclePermit", maxCount: 50 },
    { name: "vehicleFitness", maxCount: 50 },
    { name: "vehicleRequestLetter", maxCount: 50 },
    { name: "vehicleTax", maxCount: 50 },
    { name: "vehicleEmission", maxCount: 50 },
  ]),
  vendorPassController.submitPublicVendorForm
);

/**
 * All other endpoints require a JWT. The controller additionally checks
 * that the user's department is "Vendor Pass".
 */
router.post(
  "/intake",
  verifyToken,
  upload.fields([{ name: "vendorWorkOrder", maxCount: 1 }]),
  vendorPassController.createIntake
);

router.get("/list", verifyToken, vendorPassController.listIntakes);

router.post(
  "/:id/resend-link",
  verifyToken,
  vendorPassController.resendLink
);

router.delete(
  "/:id/revoke",
  verifyToken,
  vendorPassController.revokeIntake
);

/* ──────────────────────────────────────────────────────────────────────
   Vendor Pass Approval Endpoints (for approvers)
   ────────────────────────────────────────────────────────────────────── */
router.put(
  "/:id/approve-person/:personIndex",
  verifyToken,
  vendorPassController.approveVendorPerson
);

router.put(
  "/:id/reject-person/:personIndex",
  verifyToken,
  vendorPassController.rejectVendorPerson
);

router.put(
  "/:id/approve-vehicle/:vehicleIndex",
  verifyToken,
  vendorPassController.approveVendorVehicle
);

router.put(
  "/:id/reject-vehicle/:vehicleIndex",
  verifyToken,
  vendorPassController.rejectVendorVehicle
);

router.put(
  "/:id/complete-review",
  verifyToken,
  vendorPassController.completeVendorReview
);

module.exports = router;
