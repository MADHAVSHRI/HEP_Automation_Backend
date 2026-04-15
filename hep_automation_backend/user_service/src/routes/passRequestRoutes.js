const express = require("express");
const router = express.Router();
const captchaLimiter = require("../middlewares/rateLimiter");
const passRequestController = require("../controllers/passRequestController");

const upload = require("../middlewares/uploadMiddleware");

router.post("/createPassRequest",
  upload.fields([
    { name: "authLetter", maxCount: 1 },
    { name: "personPhoto", maxCount: 1 },
    { name: "personAadhar", maxCount: 1 },
    { name: "personIdProof", maxCount: 1 },
    { name: "vehicleRC", maxCount: 1 },
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

module.exports = router;
