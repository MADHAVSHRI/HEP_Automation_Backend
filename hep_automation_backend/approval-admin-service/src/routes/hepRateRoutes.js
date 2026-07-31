const express = require("express");
const router = express.Router();
const hepRateController = require("../controllers/hepRateController");
const verifyToken = require("../middlewares/verifyToken");

// All HEP rate routes require authentication
router.use(verifyToken);

router.get("/", hepRateController.getHepRates);
router.put("/:category", hepRateController.updateHepRate);

module.exports = router;
