const express = require("express");
const router = express.Router();
const iportmanController = require("../controllers/iportmanController");
const apiKeyAuth = require("../middlewares/apiKeyAuth");

router.get("/", (req, res) => {
  res.send("Welcome to the IPORTMAN Service API");
});

router.post("/weighbridge", apiKeyAuth, iportmanController.createWeighbridgeRecord);
router.get("/weighbridge", apiKeyAuth, iportmanController.getWeighbridgeRecords);
router.get("/weighbridge/:id", apiKeyAuth, iportmanController.getWeighbridgeRecordById);

module.exports = router;