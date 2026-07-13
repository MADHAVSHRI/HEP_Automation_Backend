const express = require("express");
const router = express.Router();
const iportmanController = require("../controllers/iportmanController");
const operatorAuth = require("../middlewares/operatorAuth");

router.get("/", (req, res) => {
  res.send("Welcome to the IPORTMAN Service API");
});

router.post("/weighbridge", operatorAuth, iportmanController.createWeighbridgeRecord);
router.get("/weighbridge", operatorAuth, iportmanController.getWeighbridgeRecords);
router.get("/weighbridge/:id", operatorAuth, iportmanController.getWeighbridgeRecordById);

module.exports = router;