const express = require("express");
const router = express.Router();

const verifyToken = require("../middlewares/verifyToken");
const upload = require("../middlewares/uploadMiddleware");
const { validateUploadedFileTypes } = require("../middlewares/uploadMiddleware");
const vendorPassController = require("../controllers/vendorPassController");

/**
 * Public token endpoint — declared FIRST so it does not pass through
 * verifyToken. The vendor email link must work without authentication.
 */
router.get("/visitor-types", verifyToken, vendorPassController.getVisitorTypes);
router.get("/public/work-order/:id", vendorPassController.getWorkOrderFile);
router.get("/public/:token", vendorPassController.getPublicByToken);
router.post(
  "/public/:token/submit",
  (req, res, next) => {
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
    { name: "sparkArrester", maxCount: 50 },
    { name: "twistLock", maxCount: 50 },
    { name: "entryAuthorization", maxCount: 50 },
    ])(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ success: false, message: "File size exceeds the allowed limit" });
        }
        return res.status(400).json({ success: false, message: err.message || "Invalid file upload" });
      }
      next();
    });
  },
  validateUploadedFileTypes,
  vendorPassController.submitPublicVendorForm
);

router.put(
  "/public/:id/update-person/:personIndex",
  (req, res, next) => {
    upload.fields([
      { name: "personPhoto", maxCount: 1 },
      { name: "personAadhar", maxCount: 1 },
      { name: "personIdProof", maxCount: 1 },
      { name: "requisitionLetter", maxCount: 1 },
      { name: "driverLicense", maxCount: 1 },
      { name: "policeVerification", maxCount: 1 },
      { name: "employmentProof", maxCount: 1 },
      { name: "chaLicenseCopy", maxCount: 1 },
      { name: "passportDoc", maxCount: 1 },
    { name: "entryAuthorization", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ success: false, message: "File size exceeds the allowed limit" });
        }
        return res.status(400).json({ success: false, message: err.message || "Invalid file upload" });
      }
      next();
    });
  },
  validateUploadedFileTypes,
  vendorPassController.updateVendorPerson
);

router.put(
  "/public/:id/update-vehicle/:vehicleIndex",
  (req, res, next) => {
    upload.fields([
      { name: "vehicleRC", maxCount: 1 },
      { name: "vehicleInsurance", maxCount: 1 },
      { name: "vehiclePermit", maxCount: 1 },
      { name: "vehicleFitness", maxCount: 1 },
      { name: "vehicleRequestLetter", maxCount: 1 },
      { name: "vehicleTax", maxCount: 1 },
      { name: "vehicleEmission", maxCount: 1 },
    { name: "sparkArrester", maxCount: 1 },
    { name: "twistLock", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ success: false, message: "File size exceeds the allowed limit" });
        }
        return res.status(400).json({ success: false, message: err.message || "Invalid file upload" });
      }
      next();
    });
  },
  validateUploadedFileTypes,
  vendorPassController.updateVendorVehicle
);

router.put(
  "/public/:id/resubmit",
  vendorPassController.resubmitVendorPass
);

/**
 * All other endpoints require a JWT. The controller additionally checks
 * that the user's department is "Vendor Pass".
 */
router.post(
  "/intake",
  verifyToken,
  (req, res, next) => {
    upload.fields([{ name: "vendorWorkOrder", maxCount: 1 }])(req, res, (err) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ success: false, message: "File size exceeds the allowed limit" });
        }
        return res.status(400).json({ success: false, message: err.message || "Invalid file upload" });
      }
      next();
    });
  },
  validateUploadedFileTypes,
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
  "/:id/revert-person/:personIndex",
  verifyToken,
  vendorPassController.revertVendorPerson
);

router.put(
  "/:id/revert-vehicle/:vehicleIndex",
  verifyToken,
  vendorPassController.revertVendorVehicle
);

router.put(
  "/:id/complete-review",
  verifyToken,
  vendorPassController.completeVendorReview
);

module.exports = router;
