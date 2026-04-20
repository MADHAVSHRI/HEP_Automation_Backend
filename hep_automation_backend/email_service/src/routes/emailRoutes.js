const express = require("express");
const router = express.Router();
const emailController = require("../controllers/emailController");

router.post("/sendReferenceNo", emailController.sendReference);
router.post("/sendApproval", emailController.sendApproval);
router.post("/sendRejection", emailController.sendRejection);
router.post("/sendDeptUserCreated", emailController.sendDeptUserCreation);
router.post("/sendDeptUserActivated", emailController.sendDeptUserActivated);
router.post("/sendDeptUserDisabled", emailController.sendDeptUserDisabled);
// router.post("/sendReverted", emailController.sendRevertedAgentRequest);

module.exports = router;