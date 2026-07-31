const express = require("express");
const router = express.Router();
const overstayController = require("../controllers/overstayController");
const verifyToken = require("../middlewares/verifyToken");

// All overstay routes require authentication
router.use(verifyToken);

// ATM — detection & levy
router.get("/detect", overstayController.detectOverstays);
router.get("/charges", overstayController.listCharges);
router.post("/levy", overstayController.levyCharge);
router.post("/notify-detected", overstayController.notifyDetected);
router.post("/waive-detected", overstayController.waiveDetected);
router.patch("/:id/waive", overstayController.waiveCharge);
router.post("/:id/notify", overstayController.notifyCharge);

// Agent — self-service
router.get("/my-charges", overstayController.myCharges);
router.patch("/:id/pay", overstayController.payCharge);
router.patch("/:id/request-exception", overstayController.requestException);

// Traffic — exception approvals
router.get("/exception-requests", overstayController.listExceptionRequests);
router.patch("/:id/approve-exception", overstayController.approveException);
router.patch("/:id/reject-exception", overstayController.rejectException);

router.get("/settings/auto-email", overstayController.getAutoEmailSetting);
router.patch("/settings/auto-email", overstayController.setAutoEmailSetting);
router.get("/settings/pass-block", overstayController.getPassBlockSetting);
router.patch("/settings/pass-block", overstayController.setPassBlockSetting);
module.exports = router;
