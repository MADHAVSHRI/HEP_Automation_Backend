const express = require("express");
const router = express.Router();
const emailController = require("../controllers/emailController");

router.post("/sendReferenceNo", emailController.sendReference);
router.post("/sendApproval", emailController.sendApproval);
router.post("/sendRejection", emailController.sendRejection);
router.post("/sendDeptUserCreated", emailController.sendDeptUserCreation);
router.post("/sendDeptUserActivated", emailController.sendDeptUserActivated);
router.post("/sendDeptUserDisabled", emailController.sendDeptUserDisabled);
router.post("/sendReverted", emailController.sendRevertedAgentRequest);
router.post("/sendUpdatedAfterRevert", emailController.sendUpdatedAfterRevert);
router.post("/sendVendorPassLink", emailController.sendVendorPassLink);
router.post("/sendPassReverted", emailController.sendPassReverted);
router.post("/sendVendorPassApproved", emailController.sendVendorPassApproved);
router.post("/sendForgotPasswordOTP", emailController.sendForgotPasswordOTP);
router.post("/sendForgotPasswordOtp", emailController.sendForgotPasswordOtp);

// ── Bulk Pass Email Routes ───────────────────────────────────────────────────
router.post("/sendBulkPassInvitation", emailController.sendBulkPassInvitation);
router.post("/sendBulkPassSubmitted", emailController.sendBulkPassSubmitted);
router.post("/sendBulkPassUnderReview", emailController.sendBulkPassUnderReview);
router.post("/sendBulkPassReturned", emailController.sendBulkPassReturned);
router.post("/sendBulkPassApproved", emailController.sendBulkPassApproved);
router.post("/sendBulkPassRejected", emailController.sendBulkPassRejected);

module.exports = router;