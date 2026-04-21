const express = require("express");
const router = express.Router();
const captchaLimiter = require("../middlewares/rateLimiter");
const passRequestController = require("../controllers/passRequestController");

const upload = require("../middlewares/uploadMiddleware");
const verifyToken = require( "../middlewares/verifyToken" );

router.post("/createPassRequest",verifyToken,
  upload.fields([
    { name: "authLetter", maxCount: 1 },

    { name: "personPhoto", maxCount: 50 },
    { name: "personAadhar", maxCount: 50 },
    { name: "personIdProof", maxCount: 50 },

    { name: "driverLicense", maxCount: 50 },
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
    { name: "vehicleEmission", maxCount: 50 }
  ]),
  passRequestController.createPassRequest,
);


router.get("/get-nationality", passRequestController.getNationalities); //coming from constants
router.get("/get-pass-types", passRequestController.getPassTypes); //coming from constants
router.get("/get-id-proof-types", passRequestController.getIdProofTypes); //coming from constants
router.get("/get-access-areas", passRequestController.getAccessAreas); //coming from constants
router.get("/get-visit-purposes", passRequestController.getVisitPurposes); //coming from database
router.get("/get-hep-types", passRequestController.getHepTypes); //coming from database
router.get("/get-countries", passRequestController.getCountries); //coming from database
router.get("/getDesignations", passRequestController.getDesignations); //coming from database
router.get("/getVehicleTypes", passRequestController.getvehicleTypes); //coming from database
router.get("/my-pass-requests",verifyToken, passRequestController.getAgentPassRequests); //coming from database
router.get("/my-master-records",verifyToken, passRequestController.getMasterDirectory); //coming from database
router.get(
  "/get-agent-pass-requests",
  verifyToken,
  passRequestController.getAgentPassRequestsToApproverAdmin
);
router.get("/viewPassRequestsDocument", passRequestController.viewPassRequestsDocument);

module.exports = router;
