const express = require("express");
const router = express.Router();
const emailController = require("../controllers/emailController");

router.post("/sendReferenceNo", emailController.sendReference);
router.post("/sendApproval", emailController.sendApproval);
router.post("/sendRejection", emailController.sendRejection);

module.exports = router;