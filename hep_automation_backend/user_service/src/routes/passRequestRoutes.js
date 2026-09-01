const express = require("express");
const router = express.Router();
const captchaLimiter = require("../middlewares/rateLimiter");
const passRequestController = require("../controllers/passRequestController");
const authorizeToken = require("../middlewares/authorizeToken");
const upload = require("../middlewares/uploadMiddleware");
const verifyToken = require("../middlewares/verifyToken");

router.post(
  "/createPassRequest",
  verifyToken,
  upload.any(),
  passRequestController.createPassRequest,
);

router.get("/get-nationality", passRequestController.getNationalities); //coming from constants
router.get("/get-pass-types", passRequestController.getPassTypes); //coming from constants
router.get("/get-id-proof-types", passRequestController.getIdProofTypes); //coming from constants
router.get("/get-access-areas", passRequestController.getAccessAreas); //coming from constants
router.get("/get-visit-purposes", passRequestController.getVisitPurposes); //coming from database
router.get("/get-hep-types", passRequestController.getHepTypes); //coming from database
router.get("/get-countries", passRequestController.getCountries); //coming from database
router.get("/get-states", passRequestController.getStates); //coming from database
router.get("/get-cities", passRequestController.getCities); //coming from database
router.get("/getDesignations", passRequestController.getDesignations); //coming from database
router.get("/getVehicleTypes", passRequestController.getvehicleTypes); //coming from database
router.get(
  "/my-pass-requests",
  verifyToken,
  passRequestController.getAgentPassRequests,
); //coming from database
router.get(
  "/my-master-records",
  verifyToken,
  passRequestController.getMasterDirectory,
); //coming from database
router.get(
  "/get-agent-pass-requests",
  verifyToken,
  passRequestController.getAgentPassRequestsToApproverAdmin,
);
router.get(
  "/viewPassRequestsDocument",
  passRequestController.viewPassRequestsDocument,
);
router.get(
  "/qr-data/:passRequestId",
  verifyToken,
  passRequestController.getQrData,
);

// Vendor pass QR data endpoint (public - no auth required, token-based access)

router.get(
  "/vendor-qr-data/:vendorPassId",
  passRequestController.getVendorQrData,
);

router.put("/approve-person", verifyToken, passRequestController.approvePerson);

router.put("/reject-person", verifyToken, passRequestController.rejectPerson);

router.put("/revert-person", verifyToken, passRequestController.revertPerson);

router.put(
  "/approve-vehicle",
  verifyToken,
  passRequestController.approveVehicle,
);

router.put("/reject-vehicle", verifyToken, passRequestController.rejectVehicle);

router.put("/revert-vehicle", verifyToken, passRequestController.revertVehicle);

router.put(
  "/complete-review",
  verifyToken,
  passRequestController.completeReview,
);

router.get(
  "/getPassDetails/:passRequestId",
  verifyToken,
  passRequestController.getPassDetails,
);

// Phase 2: Edit and resubmit reverted passes
router.put(
  "/update-pass-person/:personId",
  verifyToken,
  upload.fields([
    { name: "personPhoto", maxCount: 1 },
    { name: "personAadhar", maxCount: 1 },
    { name: "personIdProof", maxCount: 1 },
    { name: "driverLicense", maxCount: 1 },
    { name: "requisitionLetter", maxCount: 1 },
    { name: "policeVerification", maxCount: 1 },
    { name: "employmentProof", maxCount: 1 },
    { name: "chaLicenseCopy", maxCount: 1 },
    { name: "passportDoc", maxCount: 1 },
    { name: "visaDoc", maxCount: 1 },
    { name: "immigrationDoc", maxCount: 1 },
    { name: "cdcDocument", maxCount: 1 },
    { name: "entryAuthorization", maxCount: 1 },
  ]),
  passRequestController.updatePassPerson,
);

router.put(
  "/update-pass-vehicle/:vehicleId",
  verifyToken,
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
  ]),
  passRequestController.updatePassVehicle,
);
router.put(
  "/resubmit-reverted-pass/:passRequestId",
  verifyToken,
  passRequestController.resubmitRevertedPass,
);

// Public QR validation endpoint — called by gate scanner when a QR is scanned
// router.get("/validate-qr/:passNo", passRequestController.validateQrPass);

router.post("/save-qr-pdf-path", passRequestController.saveQrPdfPath);

router.post("/validate-qr", passRequestController.validateSecureQr);

router.get("/viewMasterDocument", passRequestController.viewMasterDocument);

router.put(
  "/update-person-status",
  verifyToken,
  passRequestController.updatePersonStatus,
);

router.put(
  "/update-vehicle-status",
  verifyToken,
  passRequestController.updateVehicleStatus,
);

router.put(
  "/disable-person-pass",
  verifyToken,
  passRequestController.disablePersonPass,
);

router.put(
  "/disable-vehicle-pass",
  verifyToken,
  passRequestController.disableVehiclePass,
);

router.put(
  "/enable-person-pass",
  verifyToken,
  passRequestController.enablePersonPass,
);

router.put(
  "/enable-vehicle-pass",
  verifyToken,
  passRequestController.enableVehiclePass,
);

router.get(
  "/disabled-passes",
  verifyToken,
  passRequestController.getDisabledPasses,
);

// Two-Wheeler Update Request routes
router.post(
  "/two-wheeler-update-request",
  verifyToken,
  passRequestController.submitTwoWheelerUpdate,
);
router.get(
  "/two-wheeler-update-requests",
  verifyToken,
  passRequestController.getTwoWheelerUpdateRequests,
);
router.put(
  "/two-wheeler-update-requests/:id/approve",
  verifyToken,
  passRequestController.approveTwoWheelerUpdate,
);
router.put(
  "/two-wheeler-update-requests/:id/reject",
  verifyToken,
  passRequestController.rejectTwoWheelerUpdate,
);

router.get(
  "/marine-safety-passes",
  verifyToken,
  passRequestController.getMarineSafetyPassRequests,
);

router.put(
  "/approve-marine-safety-vehicle",
  verifyToken,
  passRequestController.approveMarineSafetyVehicle,
);

router.put(
  "/reject-marine-safety-vehicle",
  verifyToken,
  passRequestController.rejectMarineSafetyVehicle,
);

router.put(
  "/revert-marine-safety-vehicle",
  verifyToken,
  passRequestController.revertMarineSafetyVehicle,
);

router.get(
  "/essential-oil-dock-passes",
  verifyToken,
  passRequestController.getEssentialOilDockPassRequests,
);

router.put(
  "/essential-oil-dock/vehicle-action",
  verifyToken,
  passRequestController.essentialOilDockVehicleAction,
);

router.get(
  "/essential-oil-dock-person-passes",
  verifyToken,
  passRequestController.getEssentialOilDockPersonPassRequests,
);

router.put(
  "/essential-oil-dock/person-action",
  verifyToken,
  passRequestController.essentialOilDockPersonAction,
);

module.exports = router;
