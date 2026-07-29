const express = require("express");
const router = express.Router();
const ulipController = require("../controllers/ulipController");
const verifyToken = require("../middlewares/verifyToken");

// All ULIP routes require authentication
router.post("/vahan", verifyToken, ulipController.verifyVehicle);       // by vehicle number
router.post("/sarathi02", verifyToken, ulipController.verifyDL);        // driving licence
router.post("/chassis", verifyToken, ulipController.verifyByChassis);   // by chassis number
router.post("/engine", verifyToken, ulipController.verifyByEngine);     // by engine number

module.exports = router;
