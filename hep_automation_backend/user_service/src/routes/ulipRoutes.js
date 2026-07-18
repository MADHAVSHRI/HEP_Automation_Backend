const express = require("express");
const router = express.Router();
const ulipController = require("../controllers/ulipController");
router.post("/vahan", ulipController.verifyVehicle);
router.post("/sarathi02", ulipController.verifyDL);

module.exports = router;