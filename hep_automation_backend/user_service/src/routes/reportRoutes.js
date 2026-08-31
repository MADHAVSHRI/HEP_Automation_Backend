const express = require("express");
const router = express.Router();

const reportController = require("../controllers/reportController");

router.get(
  "/registered-users/options",
  reportController.getRegisteredUserOptions,
);

router.get(
  "/registered-users",
  reportController.getRegisteredUsersReport,
);

router.get(
  "/type-of-pass-issued",
  reportController.getTypeOfPassIssuedReport,
);

router.get("/all-pass-issuance/options", reportController.getAllPassIssuanceOptions);
router.get("/all-pass-issuance", reportController.getAllPassIssuanceReport);
router.get("/revenue-report", reportController.getRevenueReport);
router.get("/pass-approval-report", reportController.getPassApprovalReport);
router.get("/gate-wise-in-out-summary", reportController.getGateWiseSummary);
router.get("/gate-lane-wise-in-out-summary", reportController.getGateLaneWiseSummary);
router.get("/card-inventory-summary", reportController.getQrInventorySummary);
router.get("/card-penalty-report", reportController.getPassPenaltyReport);

module.exports = router;
