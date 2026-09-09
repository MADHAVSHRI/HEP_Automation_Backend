const express = require("express");
const router = express.Router();
const iportmanController = require("../controllers/iportmanController");
const operatorAuth = require("../middlewares/operatorAuth");
const serviceAuth = require("../middlewares/serviceAuth");
const portEntryPermitController = require("../controllers/portEntryPermitController");

router.get("/", (req, res) => {
  res.send("Welcome to the IPORTMAN Service API");
});

router.post("/weighbridge", operatorAuth, iportmanController.createWeighbridgeRecord);
router.get("/weighbridge", operatorAuth, iportmanController.getWeighbridgeRecords);
router.get("/weighbridge/:id", operatorAuth, iportmanController.getWeighbridgeRecordById);

// Called by user_service when a pass reaches COMPLETED.
router.post(
  "/port-entry-permit",
  serviceAuth,
  portEntryPermitController.pushPassRequest,
);
router.get(
  "/port-entry-permit/:passRequestId/preview",
  serviceAuth,
  portEntryPermitController.previewPassRequest,
);

module.exports = router;