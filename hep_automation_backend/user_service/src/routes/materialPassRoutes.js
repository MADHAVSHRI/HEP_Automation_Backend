const express = require("express");
const router = express.Router();
const materialRequestController = require("../controllers/materialPassController");


router.get("/locations",materialRequestController.getPortLocations);

module.exports = router;