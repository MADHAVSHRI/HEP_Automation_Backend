const express = require("express");
const router = express.Router();
const iportmanController = require("../controllers/iportmanController");
const operatorAuth = require("../middlewares/operatorAuth");
const serviceAuth = require("../middlewares/serviceAuth");
const portEntryPermitController = require("../controllers/portEntryPermitController");
const truckGateController = require("../controllers/truckGateController");

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

// Truck gate movements. Callers are other services in this deployment; no
// caller is wired up yet.
router.post("/truck-gate-in", serviceAuth, truckGateController.truckGateIn);
router.post("/truck-gate-out", serviceAuth, truckGateController.truckGateOut);
router.post(
  "/truck-gate-:direction/preview",
  serviceAuth,
  truckGateController.previewTruckGate,
);

module.exports = router;