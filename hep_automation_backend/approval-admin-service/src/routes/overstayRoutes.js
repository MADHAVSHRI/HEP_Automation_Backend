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
router.patch("/:id/waive", overstayController.waiveCharge);

// Agent — self-service
router.get("/my-charges", overstayController.myCharges);
router.patch("/:id/pay", overstayController.payCharge);
router.patch("/:id/request-exception", overstayController.requestException);

// Traffic — exception approvals
router.get("/exception-requests", overstayController.listExceptionRequests);
router.patch("/:id/approve-exception", overstayController.approveException);
router.patch("/:id/reject-exception", overstayController.rejectException);

module.exports = router;
